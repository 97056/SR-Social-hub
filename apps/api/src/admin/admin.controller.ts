import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SocialPlatformCode } from "@prisma/client";
import type { AuthUser } from "../auth/jwt.strategy";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Roles, RolesGuard } from "../common/guards/roles.guard";
import { AdminService } from "./admin.service";
import {
  CreateCompanyDto,
  UpdateBrandingDto,
  UpdateCompanyDto,
  UpdateIntegrationDto,
  UpdatePlanDto,
  UpdateSystemSettingsDto,
} from "./dto/admin.dto";

@ApiTags("admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SUPER_ADMIN")
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("overview")
  overview() {
    return this.admin.overview();
  }

  @Get("companies")
  companies() {
    return this.admin.listCompanies();
  }

  @Post("companies")
  createCompany(@CurrentUser() user: AuthUser, @Body() dto: CreateCompanyDto) {
    return this.admin.createCompany(user, dto);
  }

  @Patch("companies/:companyId")
  updateCompany(
    @CurrentUser() user: AuthUser,
    @Param("companyId") companyId: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.admin.updateCompany(user, companyId, dto);
  }

  @Get("integrations")
  integrations() {
    return this.admin.listIntegrations();
  }

  @Patch("integrations/:code")
  updateIntegration(
    @CurrentUser() user: AuthUser,
    @Param("code") code: SocialPlatformCode,
    @Body() dto: UpdateIntegrationDto,
  ) {
    return this.admin.updateIntegration(user, code, dto);
  }

  @Get("plans")
  plans() {
    return this.admin.listPlans();
  }

  @Patch("plans/:code")
  updatePlan(
    @CurrentUser() user: AuthUser,
    @Param("code") code: string,
    @Body() dto: UpdatePlanDto,
  ) {
    return this.admin.updatePlan(user, code, dto);
  }

  @Get("branding")
  branding() {
    return this.admin.getBranding();
  }

  @Patch("branding")
  updateBranding(@CurrentUser() user: AuthUser, @Body() dto: UpdateBrandingDto) {
    return this.admin.updateBranding(user, dto);
  }

  @Get("settings")
  settings() {
    return this.admin.getSystemSettings();
  }

  @Patch("settings")
  updateSettings(@CurrentUser() user: AuthUser, @Body() dto: UpdateSystemSettingsDto) {
    return this.admin.updateSystemSettings(user, dto);
  }
}
