import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { AuthUser } from "../auth/jwt.strategy";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CompanyAccessGuard } from "../common/guards/company-access.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { Roles, RolesGuard } from "../common/guards/roles.guard";
import { BillingService } from "./billing.service";
import { EntitlementsService } from "./entitlements.service";
import {
  BillingWebhookDto,
  CancelSubscriptionDto,
  ChangePlanDto,
  CheckoutDto,
  ConfirmRazorpayDto,
  PurchaseAddonDto,
  UpdatePaymentSettingsDto,
} from "./dto/billing.dto";

@ApiTags("billing")
@Controller()
export class BillingController {
  constructor(
    private readonly billing: BillingService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Get("billing/plans")
  plans() {
    return this.billing.listPublicPlans();
  }

  /** Public pricing for landing page — mirrors Admin → Plans / Free trial. */
  @Get("public/pricing")
  publicPricing() {
    return this.billing.getPublicPricing();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Get("companies/:companyId/billing")
  companyBilling(@Param("companyId") companyId: string, @CurrentUser() user: AuthUser) {
    return this.billing.getCompanyBilling(companyId, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Get("companies/:companyId/billing/entitlements")
  companyEntitlements(@Param("companyId") companyId: string) {
    return this.entitlements.getEntitlements(companyId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Post("companies/:companyId/billing/checkout")
  checkout(
    @Param("companyId") companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CheckoutDto,
  ) {
    return this.billing.checkout(companyId, user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Post("companies/:companyId/billing/confirm-razorpay")
  confirmRazorpay(
    @Param("companyId") companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ConfirmRazorpayDto,
  ) {
    return this.billing.confirmRazorpay(companyId, user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN")
  @Get("admin/payments")
  paymentSettings() {
    return this.billing.getPaymentSettingsPublic();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN")
  @Patch("admin/payments")
  updatePaymentSettings(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePaymentSettingsDto,
  ) {
    return this.billing.updatePaymentSettings(user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Post("companies/:companyId/billing/change-plan")
  changePlan(
    @Param("companyId") companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePlanDto,
  ) {
    return this.billing.changePlan(companyId, user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Post("companies/:companyId/billing/cancel")
  cancel(
    @Param("companyId") companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CancelSubscriptionDto,
  ) {
    return this.billing.cancel(companyId, user, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, CompanyAccessGuard)
  @Post("companies/:companyId/billing/addons")
  addons(
    @Param("companyId") companyId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: PurchaseAddonDto,
  ) {
    return this.billing.purchaseAddon(companyId, user, dto);
  }

  /** Mock/live provider webhook — idempotent. */
  @Post("billing/webhooks")
  webhook(@Body() dto: BillingWebhookDto) {
    return this.billing.processWebhook(dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SUPER_ADMIN")
  @Get("admin/billing")
  adminOverview() {
    return this.billing.adminOverview();
  }
}
