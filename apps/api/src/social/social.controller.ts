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

  /** Client-portal connect (client members are not company members). */
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, ClientAccessGuard)
  @Post("clients/:clientId/social-accounts/:platform/connect")
  startConnectAsClient(
    @Param("clientId") clientId: string,
    @Param("platform") platform: SocialPlatformCode,
    @CurrentUser() user: AuthUser,
    @Body() dto: StartConnectDto,
  ) {
    return this.social.startConnectForClient({
      clientId,
      platformCode: platform,
      user,
      redirectTo: dto.redirectTo,
    });
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
  @UseGuards(JwtAuthGuard)
  @Post("social-accounts/:accountId/refresh-profile")
  refreshProfile(@Param("accountId") accountId: string, @CurrentUser() user: AuthUser) {
    return this.social.refreshProfile(accountId, user);
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
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") oauthError: string | undefined,
    @Query("error_description") oauthErrorDescription: string | undefined,
    @Res() res: Response,
  ) {
    try {
      if (oauthError) {
        throw new Error(oauthErrorDescription || oauthError);
      }
      if (!code || !state) {
        throw new Error("OAuth callback missing code or state");
      }
      const result = await this.social.handleCallback(code, state);
      return res.redirect(result.redirectTo);
    } catch (err) {
      const message = err instanceof Error ? err.message : "OAuth failed";
      const fallback = `${process.env.WEB_URL ?? "https://srsocialhub.in"}/support`;
      const target = new URL(fallback);
      // Prefer client redirect when state still resolves.
      try {
        if (state) {
          const recovered = await this.social.buildOAuthErrorRedirect(state, message);
          if (recovered) return res.redirect(recovered);
        }
      } catch {
        /* fall through */
      }
      target.searchParams.set("oauth_error", message.slice(0, 180));
      return res.redirect(target.toString());
    }
  }
}
