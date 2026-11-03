import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/jwt.strategy";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ClientAccessGuard } from "../common/guards/client-access.guard";
import { CompanyAccessGuard } from "../common/guards/company-access.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AnalyticsService } from "./analytics.service";

@ApiTags("analytics")
@ApiBearerAuth()
@Controller()
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Get("companies/:companyId/analytics")
  company(
    @Param("companyId") companyId: string,
    @CurrentUser() user: AuthUser,
    @Query("days") days?: string,
  ) {
    return this.analytics.companyOverview(companyId, user, days ? Number(days) : 30);
  }

  @UseGuards(JwtAuthGuard, ClientAccessGuard)
  @Get("clients/:clientId/analytics")
  client(
    @Param("clientId") clientId: string,
    @CurrentUser() user: AuthUser,
    @Query("days") days?: string,
  ) {
    return this.analytics.clientOverview(clientId, user, days ? Number(days) : 30);
  }
}
