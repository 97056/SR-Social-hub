import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { SocialPlatformCode } from "@prisma/client";
import type { AuthUser } from "../auth/jwt.strategy";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Roles, RolesGuard } from "../common/guards/roles.guard";
import { MailService, type MailSettings } from "../mail/mail.service";
import { AdminService } from "./admin.service";
import {
  CreateCompanyDto,
  CreatePlanDto,
  UpdateBrandingDto,
  UpdateCompanyDto,
  UpdateContactLeadDto,
  UpdateFaqsDto,
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
  constructor(
    private readonly admin: AdminService,
    private readonly mail: MailService,
  ) {}

  @Get("overview")
  overview() {
    return this.admin.overview();
  }

  @Get("companies")
  companies() {
    return this.admin.listCompanies();
  }

  @Get("companies/:companyId")
  companyDetail(@Param("companyId") companyId: string) {
    return this.admin.getCompanyDetail(companyId);
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

  @Post("companies/:companyId/activate-owner")
  activateOwner(@CurrentUser() user: AuthUser, @Param("companyId") companyId: string) {
    return this.admin.activateCompanyOwner(user, companyId);
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

  @Post("plans")
  createPlan(@CurrentUser() user: AuthUser, @Body() dto: CreatePlanDto) {
    return this.admin.createPlan(user, dto);
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

  @Get("faqs")
  faqs() {
    return this.admin.getFaqs(false);
  }

  @Patch("faqs")
  updateFaqs(@CurrentUser() user: AuthUser, @Body() dto: UpdateFaqsDto) {
    return this.admin.updateFaqs(user, dto);
  }

  @Get("contact-leads")
  contactLeads() {
    return this.admin.listContactLeads();
  }

  @Patch("contact-leads/:id")
  updateContactLead(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body() dto: UpdateContactLeadDto,
  ) {
    return this.admin.updateContactLead(user, id, dto);
  }

  @Get("mail-settings")
  async mailSettings() {
    const settings = await this.mail.getSettings();
    return this.mail.publicSettings(settings);
  }

  @Patch("mail-settings")
  async updateMailSettings(@Body() dto: Partial<MailSettings>) {
    // Ignore masked placeholders so we don't overwrite real secrets
    const clean = { ...dto };
    if (clean.smtpPass === "••••••••") delete clean.smtpPass;
    if (clean.sendgridApiKey === "••••••••") delete clean.sendgridApiKey;
    if (clean.twilioAuthToken === "••••••••") delete clean.twilioAuthToken;
    return this.mail.updateSettings(clean);
  }
}
