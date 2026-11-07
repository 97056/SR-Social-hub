import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BillingInterval, Prisma } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import type { AuthUser } from "../auth/jwt.strategy";
import { decryptSecret, encryptSecret, maskSecret } from "../common/crypto.util";
import { PrismaService } from "../prisma/prisma.service";
import { EntitlementsService } from "./entitlements.service";
import type {
  CancelSubscriptionDto,
  ChangePlanDto,
  CheckoutDto,
  ConfirmRazorpayDto,
  PurchaseAddonDto,
  UpdatePaymentSettingsDto,
} from "./dto/billing.dto";
import { createRazorpayOrder, verifyRazorpaySignature } from "./razorpay.util";

type PaymentSettings = {
  provider: "razorpay";
  mode: "test" | "live";
  selfServeEnabled: boolean;
  testKeyId: string;
  testKeySecretEncrypted: string | null;
  liveKeyId: string;
  liveKeySecretEncrypted: string | null;
};

const DEFAULT_PAYMENTS: PaymentSettings = {
  provider: "razorpay",
  mode: "test",
  selfServeEnabled: false,
  testKeyId: "",
  testKeySecretEncrypted: null,
  liveKeyId: "",
  liveKeySecretEncrypted: null,
};

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  listPublicPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { monthlyPriceInr: "asc" },
    });
  }

  /** Landing + billing catalog: active plans + free-trial settings from Admin. */
  async getPublicPricing() {
    const [plans, systemRow] = await Promise.all([
      this.listPublicPlans(),
      this.prisma.systemSetting.findUnique({ where: { key: "system" } }),
    ]);
    const system = (systemRow?.value ?? {}) as {
      trialDays?: number;
      trialClientQuota?: number;
      trialAccountQuota?: number;
    };
    return {
      trial: {
        days: Math.max(1, Number(system.trialDays ?? 7)),
        clientQuota: Math.max(1, Number(system.trialClientQuota ?? 1)),
        accountQuota: Math.max(1, Number(system.trialAccountQuota ?? 2)),
        priceInr: 0,
      },
      plans,
    };
  }

  async getCompanyBilling(companyId: string, user: AuthUser) {
    await this.assertCompanyAccess(companyId, user);
    const entitlements = await this.entitlements.getEntitlements(companyId);
    const subscription = await this.prisma.subscription.findFirst({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: {
        plan: true,
        addons: true,
      },
    });
    const invoices = await this.prisma.invoice.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 24,
      include: { payments: { orderBy: { createdAt: "desc" }, take: 3 } },
    });
    const payments = await this.prisma.payment.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      take: 24,
    });

    const paymentsCfg = await this.getPaymentSettingsRaw();
    const selfServe = await this.isSelfServeEnabled(paymentsCfg);
    const razorpay = this.resolveRazorpayCredentials(paymentsCfg);

    return {
      entitlements,
      subscription,
      invoices,
      payments,
      billingMode: razorpay ? paymentsCfg.mode : process.env.BILLING_MODE === "live" ? "live" : "mock",
      selfServeEnabled: selfServe,
      razorpayKeyId: razorpay?.keyId ?? null,
      note: selfServe
        ? razorpay
          ? `Self-serve upgrades enabled via Razorpay (${paymentsCfg.mode}).`
          : "Self-serve enabled (mock settlement — configure Razorpay keys in Admin → Payments)."
        : "Plans and quotas are managed by SR Social Hub admin only (self-serve checkout disabled).",
    };
  }

  async getPaymentSettingsPublic() {
    const raw = await this.getPaymentSettingsRaw();
    return {
      provider: raw.provider,
      mode: raw.mode,
      selfServeEnabled: raw.selfServeEnabled,
      testKeyId: raw.testKeyId || "",
      liveKeyId: raw.liveKeyId || "",
      testKeySecret: maskSecret(raw.testKeySecretEncrypted),
      liveKeySecret: maskSecret(raw.liveKeySecretEncrypted),
      hasTestSecret: Boolean(raw.testKeySecretEncrypted),
      hasLiveSecret: Boolean(raw.liveKeySecretEncrypted),
    };
  }

  async updatePaymentSettings(actor: AuthUser, dto: UpdatePaymentSettingsDto) {
    const current = await this.getPaymentSettingsRaw();
    const next: PaymentSettings = {
      ...current,
      mode: dto.mode ?? current.mode,
      selfServeEnabled:
        typeof dto.selfServeEnabled === "boolean" ? dto.selfServeEnabled : current.selfServeEnabled,
      testKeyId: dto.testKeyId?.trim() || current.testKeyId,
      liveKeyId: dto.liveKeyId?.trim() || current.liveKeyId,
      testKeySecretEncrypted: current.testKeySecretEncrypted,
      liveKeySecretEncrypted: current.liveKeySecretEncrypted,
    };
    if (dto.testKeySecret && dto.testKeySecret !== "••••••••") {
      next.testKeySecretEncrypted = encryptSecret(dto.testKeySecret.trim());
    }
    if (dto.liveKeySecret && dto.liveKeySecret !== "••••••••") {
      next.liveKeySecretEncrypted = encryptSecret(dto.liveKeySecret.trim());
    }
    await this.prisma.systemSetting.upsert({
      where: { key: "payments" },
      create: { key: "payments", value: next },
      update: { value: next },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId: actor.id,
        action: "ADMIN_PAYMENTS_UPDATED",
        entityType: "SystemSetting",
        entityId: "payments",
        metadata: {
          mode: next.mode,
          selfServeEnabled: next.selfServeEnabled,
          testKeyId: next.testKeyId ? `${next.testKeyId.slice(0, 8)}…` : null,
          liveKeyId: next.liveKeyId ? `${next.liveKeyId.slice(0, 8)}…` : null,
        },
      },
    });
    return this.getPaymentSettingsPublic();
  }

  async checkout(companyId: string, user: AuthUser, dto: CheckoutDto) {
    await this.assertCompanyOwnerOrAdmin(companyId, user);
    const paymentsCfg = await this.getPaymentSettingsRaw();
    if (!(await this.isSelfServeEnabled(paymentsCfg))) {
      throw new BadRequestException(
        "Plan changes are admin-managed only. Ask SR Social Hub admin to assign a plan or enable self-serve payments.",
      );
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { code: dto.planCode },
    });
    if (!plan || !plan.isActive) throw new NotFoundException("Plan not found");
    if (plan.isCustom && plan.monthlyPriceInr <= 0) {
      throw new BadRequestException("Enterprise plans require sales-assisted checkout");
    }

    const interval: BillingInterval = dto.interval === "YEARLY" ? "YEARLY" : "MONTHLY";
    const amount =
      interval === "YEARLY"
        ? plan.yearlyPriceInr ?? plan.monthlyPriceInr * 10
        : plan.monthlyPriceInr;

    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException("Company not found");

    const now = new Date();
    const periodEnd = new Date(now);
    if (interval === "YEARLY") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const razorpayCreds = this.resolveRazorpayCredentials(paymentsCfg);

    // Razorpay path: create OPEN invoice first, charge, then activate on confirm.
    if (razorpayCreds) {
      const invoice = await this.prisma.invoice.create({
        data: {
          companyId,
          number: invoiceNumber,
          status: "OPEN",
          subtotalInr: amount,
          taxInr: 0,
          totalInr: amount,
          periodStart: now,
          periodEnd,
          dueAt: now,
          lineItems: [
            {
              description: `${plan.name} (${interval.toLowerCase()})`,
              amountInr: amount,
              quantity: 1,
              planCode: plan.code,
              interval,
            },
          ] as Prisma.InputJsonValue,
        },
      });

      try {
        const order = await createRazorpayOrder({
          keyId: razorpayCreds.keyId,
          keySecret: razorpayCreds.keySecret,
          amountInr: amount,
          receipt: invoice.number,
          notes: {
            companyId,
            planCode: plan.code,
            interval,
            invoiceId: invoice.id,
          },
        });

        await this.prisma.auditLog.create({
          data: {
            actorId: user.id,
            companyId,
            action: "BILLING_CHECKOUT_STARTED",
            entityType: "Invoice",
            entityId: invoice.id,
            metadata: {
              planCode: plan.code,
              interval,
              amountInr: amount,
              mode: paymentsCfg.mode,
              razorpayOrderId: order.id,
            },
          },
        });

        return {
          mode: "razorpay" as const,
          invoiceId: invoice.id,
          planCode: plan.code,
          interval,
          amountInr: amount,
          currency: "INR",
          razorpay: {
            keyId: razorpayCreds.keyId,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            name: "SR Social Hub",
            description: `${plan.name} · ${interval.toLowerCase()}`,
            prefill: { name: company.name },
          },
        };
      } catch (err) {
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { status: "VOID" },
        });
        throw new BadRequestException(
          err instanceof Error ? err.message : "Failed to start Razorpay checkout",
        );
      }
    }

    // Mock path (dev / no keys): activate immediately.
    const result = await this.activatePaidPlan({
      companyId,
      userId: user.id,
      planId: plan.id,
      planCode: plan.code,
      planName: plan.name,
      interval,
      amount,
      invoiceNumber,
      now,
      periodEnd,
      provider: "mock",
      providerSubId: `mock_sub_${randomBytes(6).toString("hex")}`,
    });

    await this.processWebhook({
      provider: "mock",
      eventType: "payment.succeeded",
      idempotencyKey: `mock_pay_${result.invoiceId}`,
      payload: {
        invoiceId: result.invoiceId,
        companyId,
        amountInr: amount,
        providerPaymentId: `mock_pay_${randomBytes(6).toString("hex")}`,
      },
    });

    return {
      mode: "mock" as const,
      ...(await this.getCompanyBilling(companyId, user)),
    };
  }

  async confirmRazorpay(companyId: string, user: AuthUser, dto: ConfirmRazorpayDto) {
    await this.assertCompanyOwnerOrAdmin(companyId, user);
    const paymentsCfg = await this.getPaymentSettingsRaw();
    const creds = this.resolveRazorpayCredentials(paymentsCfg);
    if (!creds) throw new BadRequestException("Razorpay is not configured");

    const ok = verifyRazorpaySignature({
      orderId: dto.razorpayOrderId,
      paymentId: dto.razorpayPaymentId,
      signature: dto.razorpaySignature,
      keySecret: creds.keySecret,
    });
    if (!ok) throw new BadRequestException("Invalid Razorpay payment signature");

    const invoice = await this.prisma.invoice.findFirst({
      where: { id: dto.invoiceId, companyId },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (invoice.status === "PAID") {
      return this.getCompanyBilling(companyId, user);
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { code: dto.planCode },
    });
    if (!plan || !plan.isActive) throw new NotFoundException("Plan not found");

    const interval: BillingInterval = dto.interval === "YEARLY" ? "YEARLY" : "MONTHLY";
    const now = new Date();
    const periodEnd = new Date(now);
    if (interval === "YEARLY") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    await this.activatePaidPlan({
      companyId,
      userId: user.id,
      planId: plan.id,
      planCode: plan.code,
      planName: plan.name,
      interval,
      amount: invoice.totalInr,
      invoiceNumber: invoice.number,
      now,
      periodEnd,
      provider: "razorpay",
      providerSubId: dto.razorpayOrderId,
      existingInvoiceId: invoice.id,
    });

    await this.processWebhook({
      provider: "razorpay",
      eventType: "payment.succeeded",
      idempotencyKey: `rzp_${dto.razorpayPaymentId}`,
      payload: {
        invoiceId: invoice.id,
        companyId,
        amountInr: invoice.totalInr,
        providerPaymentId: dto.razorpayPaymentId,
        razorpayOrderId: dto.razorpayOrderId,
      },
    });

    return this.getCompanyBilling(companyId, user);
  }

  async changePlan(companyId: string, user: AuthUser, dto: ChangePlanDto) {
    await this.assertCompanyOwnerOrAdmin(companyId, user);
    if (!(await this.isSelfServeEnabled())) {
      throw new BadRequestException(
        "Plan changes are admin-managed only. Ask SR Social Hub admin to assign a plan or enable self-serve payments.",
      );
    }
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { code: dto.planCode } });
    if (!plan || !plan.isActive) throw new NotFoundException("Plan not found");

    const current = await this.prisma.subscription.findFirst({
      where: { companyId, status: { in: ["TRIALING", "ACTIVE", "GRACE", "PAST_DUE"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!current) {
      return this.checkout(companyId, user, {
        planCode: dto.planCode,
        interval: dto.interval ?? "MONTHLY",
      });
    }

    const interval = dto.interval ?? current.interval;
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: current.id },
        data: {
          planId: plan.id,
          interval,
          status: current.status === "TRIALING" ? "TRIALING" : "ACTIVE",
        },
      });
      await tx.company.update({
        where: { id: companyId },
        data: { planId: plan.id },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          companyId,
          action: "BILLING_PLAN_CHANGED",
          entityType: "Subscription",
          entityId: current.id,
          metadata: { planCode: plan.code, interval },
        },
      });
    });

    return this.getCompanyBilling(companyId, user);
  }

  async cancel(companyId: string, user: AuthUser, dto: CancelSubscriptionDto) {
    await this.assertCompanyOwnerOrAdmin(companyId, user);
    const current = await this.prisma.subscription.findFirst({
      where: { companyId, status: { in: ["TRIALING", "ACTIVE", "GRACE", "PAST_DUE"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!current) throw new NotFoundException("No active subscription");

    const now = new Date();
    const immediate = Boolean(dto.immediate);
    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: current.id },
        data: immediate
          ? {
              status: "CANCELLED",
              cancelledAt: now,
              cancelAtPeriodEnd: false,
            }
          : {
              cancelAtPeriodEnd: true,
              cancelledAt: now,
            },
      });
      if (immediate) {
        await tx.company.update({
          where: { id: companyId },
          data: { status: "CANCELLED" },
        });
      }
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          companyId,
          action: immediate ? "BILLING_CANCELLED_IMMEDIATE" : "BILLING_CANCEL_AT_PERIOD_END",
          entityType: "Subscription",
          entityId: current.id,
          metadata: { immediate },
        },
      });
    });

    return this.getCompanyBilling(companyId, user);
  }

  async purchaseAddon(companyId: string, user: AuthUser, dto: PurchaseAddonDto) {
    await this.assertCompanyOwnerOrAdmin(companyId, user);
    if (!(await this.isSelfServeEnabled())) {
      throw new BadRequestException(
        "Add-ons are admin-managed only. Ask SR Social Hub admin to adjust client quota.",
      );
    }
    if (dto.code !== "EXTRA_CLIENT") {
      throw new BadRequestException("Unsupported add-on code");
    }
    const quantity = Math.max(1, dto.quantity ?? 1);
    const unitPrice = 299;
    const current = await this.prisma.subscription.findFirst({
      where: { companyId, status: { in: ["TRIALING", "ACTIVE", "GRACE"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!current) throw new BadRequestException("Subscribe to a plan before purchasing add-ons");

    const now = new Date();
    const invoiceNumber = `INV-ADDON-${randomBytes(3).toString("hex").toUpperCase()}`;
    const total = unitPrice * quantity;

    await this.prisma.$transaction(async (tx) => {
      await tx.subscriptionAddon.upsert({
        where: {
          subscriptionId_code: { subscriptionId: current.id, code: "EXTRA_CLIENT" },
        },
        create: {
          subscriptionId: current.id,
          code: "EXTRA_CLIENT",
          name: "Additional client seat",
          quantity,
          unitPriceInr: unitPrice,
        },
        update: {
          quantity: { increment: quantity },
        },
      });
      await tx.subscription.update({
        where: { id: current.id },
        data: { addonClientSeats: { increment: quantity } },
      });

      const invoice = await tx.invoice.create({
        data: {
          companyId,
          subscriptionId: current.id,
          number: invoiceNumber,
          status: "OPEN",
          subtotalInr: total,
          totalInr: total,
          dueAt: now,
          lineItems: [
            {
              description: `Additional client seat × ${quantity}`,
              amountInr: total,
              quantity,
            },
          ] as Prisma.InputJsonValue,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          companyId,
          action: "BILLING_ADDON_PURCHASED",
          entityType: "Invoice",
          entityId: invoice.id,
          metadata: { code: "EXTRA_CLIENT", quantity, totalInr: total },
        },
      });

      return invoice;
    });

    if (process.env.BILLING_MODE !== "live") {
      const invoice = await this.prisma.invoice.findUniqueOrThrow({
        where: { number: invoiceNumber },
      });
      await this.processWebhook({
        provider: "mock",
        eventType: "payment.succeeded",
        idempotencyKey: `mock_addon_${invoice.id}_${quantity}`,
        payload: {
          invoiceId: invoice.id,
          companyId,
          amountInr: total,
          providerPaymentId: `mock_pay_${randomBytes(6).toString("hex")}`,
        },
      });
    }

    return this.getCompanyBilling(companyId, user);
  }

  async processWebhook(input: {
    provider: string;
    eventType: string;
    idempotencyKey: string;
    payload: Record<string, unknown>;
  }) {
    const existing = await this.prisma.billingEvent.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing?.processedAt) {
      return { ok: true, duplicate: true, eventId: existing.id };
    }

    const event =
      existing ??
      (await this.prisma.billingEvent.create({
        data: {
          provider: input.provider,
          eventType: input.eventType,
          idempotencyKey: input.idempotencyKey,
          payload: input.payload as Prisma.InputJsonValue,
        },
      }));

    if (input.eventType === "payment.succeeded") {
      const invoiceId = String(input.payload.invoiceId ?? "");
      const companyId = String(input.payload.companyId ?? "");
      const amountInr = Number(input.payload.amountInr ?? 0);
      const providerPaymentId = String(
        input.payload.providerPaymentId ?? `pay_${createHash("sha256").update(input.idempotencyKey).digest("hex").slice(0, 12)}`,
      );

      if (!invoiceId || !companyId) {
        throw new BadRequestException("Webhook payload missing invoiceId/companyId");
      }

      await this.prisma.$transaction(async (tx) => {
        await tx.payment.upsert({
          where: { idempotencyKey: input.idempotencyKey },
          create: {
            companyId,
            invoiceId,
            provider: input.provider,
            providerPaymentId,
            amountInr,
            status: "SUCCEEDED",
            rawPayload: input.payload as Prisma.InputJsonValue,
            idempotencyKey: input.idempotencyKey,
          },
          update: {
            status: "SUCCEEDED",
            providerPaymentId,
            rawPayload: input.payload as Prisma.InputJsonValue,
          },
        });
        await tx.invoice.update({
          where: { id: invoiceId },
          data: { status: "PAID", paidAt: new Date() },
        });
        await tx.subscription.updateMany({
          where: { companyId, status: { in: ["PAST_DUE", "GRACE", "TRIALING"] } },
          data: { status: "ACTIVE", graceEndsAt: null },
        });
        await tx.company.update({
          where: { id: companyId },
          data: { status: "ACTIVE" },
        });
      });
    }

    if (input.eventType === "payment.failed") {
      const companyId = String(input.payload.companyId ?? "");
      const invoiceId = input.payload.invoiceId ? String(input.payload.invoiceId) : null;
      const graceEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      await this.prisma.$transaction(async (tx) => {
        if (invoiceId) {
          await tx.payment.create({
            data: {
              companyId,
              invoiceId,
              provider: input.provider,
              amountInr: Number(input.payload.amountInr ?? 0),
              status: "FAILED",
              failureReason: String(input.payload.reason ?? "payment_failed"),
              rawPayload: input.payload as Prisma.InputJsonValue,
              idempotencyKey: input.idempotencyKey,
            },
          });
        }
        await tx.subscription.updateMany({
          where: { companyId, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
          data: { status: "PAST_DUE", graceEndsAt },
        });
      });
    }

    await this.prisma.billingEvent.update({
      where: { id: event.id },
      data: { processedAt: new Date() },
    });

    return { ok: true, duplicate: false, eventId: event.id };
  }

  async adminOverview() {
    const [subscriptions, invoices, mrrCompanies] = await Promise.all([
      this.prisma.subscription.findMany({
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: {
          plan: true,
          company: { select: { id: true, name: true, slug: true, status: true } },
        },
      }),
      this.prisma.invoice.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { company: { select: { id: true, name: true } } },
      }),
      this.prisma.subscription.findMany({
        where: { status: "ACTIVE", interval: "MONTHLY" },
        include: { plan: true },
      }),
    ]);

    const mrr = mrrCompanies.reduce((sum, s) => sum + s.plan.monthlyPriceInr, 0);
    return {
      mrrInr: mrr,
      activeSubscriptions: subscriptions.filter((s) => s.status === "ACTIVE").length,
      trialing: subscriptions.filter((s) => s.status === "TRIALING").length,
      pastDue: subscriptions.filter((s) => s.status === "PAST_DUE" || s.status === "GRACE").length,
      subscriptions,
      invoices,
    };
  }

  async ensureTrialSubscription(companyId: string, planId: string, trialEndsAt: Date) {
    const existing = await this.prisma.subscription.findFirst({
      where: { companyId },
    });
    if (existing) return existing;
    const now = new Date();
    return this.prisma.subscription.create({
      data: {
        companyId,
        planId,
        status: "TRIALING",
        interval: "MONTHLY",
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        trialEndsAt,
        provider: "mock",
      },
    });
  }

  private async getPaymentSettingsRaw(): Promise<PaymentSettings> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key: "payments" } });
    return { ...DEFAULT_PAYMENTS, ...((row?.value as Partial<PaymentSettings>) ?? {}) };
  }

  private async isSelfServeEnabled(cfg?: PaymentSettings): Promise<boolean> {
    if (process.env.BILLING_SELF_SERVE === "true") return true;
    const settings = cfg ?? (await this.getPaymentSettingsRaw());
    return Boolean(settings.selfServeEnabled);
  }

  private resolveRazorpayCredentials(cfg: PaymentSettings): { keyId: string; keySecret: string } | null {
    const keyId = cfg.mode === "live" ? cfg.liveKeyId : cfg.testKeyId;
    const enc = cfg.mode === "live" ? cfg.liveKeySecretEncrypted : cfg.testKeySecretEncrypted;
    if (!keyId || !enc) return null;
    try {
      return { keyId, keySecret: decryptSecret(enc) };
    } catch {
      return null;
    }
  }

  private async activatePaidPlan(input: {
    companyId: string;
    userId: string;
    planId: string;
    planCode: string;
    planName: string;
    interval: BillingInterval;
    amount: number;
    invoiceNumber: string;
    now: Date;
    periodEnd: Date;
    provider: string;
    providerSubId: string;
    existingInvoiceId?: string;
  }) {
    return this.prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: {
          companyId: input.companyId,
          status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "GRACE"] },
        },
        data: {
          status: "CANCELLED",
          cancelledAt: input.now,
          cancelAtPeriodEnd: false,
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          companyId: input.companyId,
          planId: input.planId,
          status: "ACTIVE",
          interval: input.interval,
          currentPeriodStart: input.now,
          currentPeriodEnd: input.periodEnd,
          trialEndsAt: null,
          provider: input.provider,
          providerSubId: input.providerSubId,
        },
      });

      let invoiceId = input.existingInvoiceId;
      if (invoiceId) {
        await tx.invoice.update({
          where: { id: invoiceId },
          data: { subscriptionId: subscription.id },
        });
      } else {
        const invoice = await tx.invoice.create({
          data: {
            companyId: input.companyId,
            subscriptionId: subscription.id,
            number: input.invoiceNumber,
            status: "OPEN",
            subtotalInr: input.amount,
            taxInr: 0,
            totalInr: input.amount,
            periodStart: input.now,
            periodEnd: input.periodEnd,
            dueAt: input.now,
            lineItems: [
              {
                description: `${input.planName} (${input.interval.toLowerCase()})`,
                amountInr: input.amount,
                quantity: 1,
              },
            ] as Prisma.InputJsonValue,
          },
        });
        invoiceId = invoice.id;
      }

      await tx.company.update({
        where: { id: input.companyId },
        data: {
          planId: input.planId,
          status: "ACTIVE",
          trialEndsAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: input.userId,
          companyId: input.companyId,
          action: "BILLING_CHECKOUT_STARTED",
          entityType: "Subscription",
          entityId: subscription.id,
          metadata: {
            planCode: input.planCode,
            interval: input.interval,
            amountInr: input.amount,
            provider: input.provider,
          },
        },
      });

      return { subscriptionId: subscription.id, invoiceId: invoiceId! };
    });
  }

  private async assertCompanyAccess(companyId: string, user: AuthUser) {
    if (user.globalRole === "SUPER_ADMIN") return;
    const membership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: user.id } },
    });
    if (!membership || membership.status !== "ACTIVE") {
      throw new BadRequestException("No company access");
    }
  }

  private async assertCompanyOwnerOrAdmin(companyId: string, user: AuthUser) {
    if (user.globalRole === "SUPER_ADMIN") return;
    const membership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId: user.id } },
    });
    if (!membership || membership.status !== "ACTIVE") {
      throw new BadRequestException("No company access");
    }
    if (!["OWNER", "ADMIN"].includes(membership.role)) {
      throw new BadRequestException("Only company owners/admins can manage billing");
    }
  }
}
