import {
  Body,
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { memoryStorage } from "multer";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthService } from "./auth.service";
import { AcceptInviteDto } from "./dto/accept-invite.dto";
import { AdminLoginDto, LoginDto } from "./dto/login.dto";
import { RefreshDto } from "./dto/refresh.dto";
import {
  ActivateAccountDto,
  ForgotPasswordDto,
  RegisterDto,
  ResetPasswordDto,
} from "./dto/register.dto";
import type { AuthUser } from "./jwt.strategy";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("login")
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto.email, dto.password, false);
    this.setRefreshCookie(res);
    return result;
  }

  @Post("register")
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        accountKind: { type: "string", enum: ["INDIVIDUAL", "COMPANY"] },
        fullName: { type: "string" },
        email: { type: "string" },
        password: { type: "string" },
        phone: { type: "string" },
        companyName: { type: "string" },
        website: { type: "string" },
        gstNumber: { type: "string" },
        gstDocument: { type: "string", format: "binary" },
      },
    },
  })
  @UseInterceptors(FileInterceptor("gstDocument", { storage: memoryStorage() }))
  register(@Body() dto: RegisterDto, @UploadedFile() gstDocument?: Express.Multer.File) {
    return this.auth.register(dto, gstDocument);
  }

  @Post("activate")
  activate(@Body() dto: ActivateAccountDto) {
    return this.auth.activateAccount(dto.token);
  }

  @Post("resend-activation")
  resendActivation(@Body() dto: ForgotPasswordDto) {
    return this.auth.resendActivation(dto.email);
  }

  @Post("forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgotPassword(dto.email);
  }

  @Post("reset-password")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  @Post("accept-invite")
  async acceptInvite(@Body() dto: AcceptInviteDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.acceptInvite(dto);
    this.setRefreshCookie(res);
    return result;
  }

  @Post("admin/login")
  async adminLogin(@Body() dto: AdminLoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto.email, dto.password, true);
    this.setRefreshCookie(res);
    return result;
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @Post("refresh")
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refreshSession(dto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("logout")
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    res.clearCookie("sr_refresh");
    return this.auth.logout(user.id);
  }

  private setRefreshCookie(res: Response) {
    res.cookie("sr_refresh", "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.COOKIE_SECURE === "true",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }
}
