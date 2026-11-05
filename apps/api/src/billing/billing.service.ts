import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { BillingInterval, Prisma } from "@prisma/client";
import { createHash, randomBytes } from "crypto";
import type { AuthUser } from "../auth/jwt.strategy";
import { PrismaService } from "../prisma/prisma.service";
import { EntitlementsService } from "./entitlements.service";
import type {
  CancelSubscriptionDto,
  ChangePlanDto,
  CheckoutDto,
  PurchaseAddonDto,
} from "./dto/billing.dto";

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

    return {
      entitlements,
      subscription,
      invoices,
      payments,
      billingMode: process.env.BILLING_MODE === "live" ? "live" : "mock",
      note:
        process.env.BILLING_SELF_SERVE === "true"
          ? process.env.BILLING_MODE === "live"
            ? "Live payment provider configured."
            : "Mock billing: payments are simulated locally and never charge a real card."
          : "Plans and quotas are managed by SR Social Hub admin only (self-serve checkout disabled).",
    };
  }

  async checkout(companyId: string, user: AuthUser, dto: CheckoutDto) {
    await this.assertCompanyOwnerOrAdmin(companyId, user);
    if (process.env.BILLING_SELF_SERVE !== "true") {
      throw new BadRequestException(
        "Plan changes are admin-managed only. Ask SR Social Hub admin to assign a plan or negotiate custom quota.",
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

    const now = new Date();
    const periodEnd = new Date(now);
    if (interval === "YEARLY") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    else periodEnd.setMonth(periodEnd.getMonth() + 1);

    const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${randomBytes(3).toString("hex").toUpperCase()}`;

    const result = await this.prisma.$transaction(async (tx) => {
      // End prior open subscriptions
      await tx.subscription.updateMany({
        where: {
          companyId,
          status: { in: ["TRIALING", "ACTIVE", "PAST_DUE", "GRACE"] },
        },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          cancelAtPeriodEnd: false,
        },
      });

      const subscription = await tx.subscription.create({
        data: {
          companyId,
          planId: plan.id,
          status: "ACTIVE",
          interval,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          trialEndsAt: null,
          provider: "mock",
          providerSubId: `mock_sub_${randomBytes(6).toString("hex")}`,
        },
      });

      const invoice = await tx.invoice.create({
        data: {
          companyId,
          subscriptionId: subscription.id,
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
            },
          ] as Prisma.InputJsonValue,
        },
      });

      await tx.company.update({
        where: { id: companyId },
        data: {
          planId: plan.id,
          status: "ACTIVE",
          trialEndsAt: null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          companyId,
          action: "BILLING_CHECKOUT_STARTED",
          entityType: "Subscription",
          entityId: subscription.id,
          metadata: { planCode: plan.code, interval, amountInr: amount, mode: "mock" },
        },
      });

      return { subscription, invoice, amount };
    });

    // Mock provider: immediately settle via internal webhook path
    if (process.env.BILLING_MODE !== "live") {
      await this.processWebhook({
        provider: "mock",
        eventType: "payment.succeeded",
        idempotencyKey: `mock_pay_${result.invoice.id}`,
        payload: {
          invoiceId: result.invoice.id,
          companyId,
          amountInr: result.amount,
          providerPaymentId: `mock_pay_${randomBytes(6).toString("hex")}`,
        },
      });
    }

    return this.getCompanyBilling(companyId, user);
  }

  async changePlan(companyId: string, user: AuthUser, dto: ChangePlanDto) {
    await this.assertCompanyOwnerOrAdmin(companyId, user);
    if (process.env.BILLING_SELF_SERVE !== "true") {
      throw new BadRequestException(
        "Plan changes are admin-managed only. Ask SR Social Hub admin to assign a plan or negotiate custom quota.",
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
    if (process.env.BILLING_SELF_SERVE !== "true") {
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
