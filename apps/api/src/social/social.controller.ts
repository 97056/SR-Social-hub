import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SocialPlatformCode } from "@prisma/client";
import type { Response } from "express";
import type { AuthUser } from "../auth/jwt.strategy";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ClientAccessGuard } from "../common/guards/client-access.guard";
import { CompanyAccessGuard } from "../common/guards/company-access.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { SocialService } from "./social.service";
import { StartConnectDto } from "./dto/start-connect.dto";

@ApiTags("social")
@Controller()
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Get("companies/:companyId/social-accounts")
  companyAccounts(@Param("companyId") companyId: string) {
    return this.social.listForCompany(companyId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ClientAccessGuard)
  @Get("clients/:clientId/social-accounts")
  clientAccounts(@Param("clientId") clientId: string) {
    return this.social.listForClientId(clientId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Post("companies/:companyId/clients/:clientId/social-accounts/:platform/connect")
  startConnect(
    @Param("companyId") companyId: string,
    @Param("clientId") clientId: string,
    @Param("platform") platform: SocialPlatformCode,
    @CurrentUser() user: AuthUser,
    @Body() dto: StartConnectDto,
  ) {
    return this.social.startConnect({
      companyId,
      clientId,
      platformCode: platform,
      user,
      redirectTo: dto.redirectTo,
    });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("social-accounts/:accountId/disconnect")
  disconnect(@Param("accountId") accountId: string, @CurrentUser() user: AuthUser) {
    return this.social.disconnect(accountId, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Post("companies/:companyId/clients/:clientId/social-accounts/:platform/reauthorize")
  reauthorize(
    @Param("companyId") companyId: string,
    @Param("clientId") clientId: string,
    @Param("platform") platform: SocialPlatformCode,
    @CurrentUser() user: AuthUser,
    @Body() dto: StartConnectDto,
  ) {
    return this.social.startConnect({
      companyId,
      clientId,
      platformCode: platform,
      user,
      redirectTo: dto.redirectTo,
    });
  }

  /** OAuth callback — no JWT; validated via signed/random state row. */
  @Get("oauth/callback")
  async callback(
    @Query("code") code: string,
    @Query("state") state: string,
    @Res() res: Response,
  ) {
    const result = await this.social.handleCallback(code, state);
    return res.redirect(result.redirectTo);
  }
}
