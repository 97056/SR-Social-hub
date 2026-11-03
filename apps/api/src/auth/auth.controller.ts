import { Body, Controller, Get, Post, Res, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuthService } from "./auth.service";
import { AcceptInviteDto } from "./dto/accept-invite.dto";
import { AdminLoginDto, LoginDto } from "./dto/login.dto";
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
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }
}
