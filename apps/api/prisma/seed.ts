import {
  CompanyRole,
  ClientRole,
  GlobalRole,
  PrismaClient,
  SocialPlatformCode,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const platforms: Array<{ code: SocialPlatformCode; name: string }> = [
    { code: "FACEBOOK", name: "Facebook" },
    { code: "INSTAGRAM", name: "Instagram" },
    { code: "LINKEDIN", name: "LinkedIn" },
    { code: "X", name: "X" },
    { code: "YOUTUBE", name: "YouTube" },
    { code: "TIKTOK", name: "TikTok" },
    { code: "PINTEREST", name: "Pinterest" },
    { code: "THREADS", name: "Threads" },
    { code: "GOOGLE_BUSINESS", name: "Google Business Profile" },
  ];

  for (const platform of platforms) {
    await prisma.socialPlatform.upsert({
      where: { code: platform.code },
      update: { name: platform.name },
      create: { ...platform, enabled: false },
    });
  }

  const plans = [
    {
      code: "STARTER",
      name: "Starter",
      monthlyPriceInr: 999,
      yearlyPriceInr: 9990,
      clientQuota: 3,
    },
    {
      code: "GROWTH",
      name: "Growth",
      monthlyPriceInr: 1999,
      yearlyPriceInr: 19990,
      clientQuota: 6,
    },
    {
      code: "AGENCY_PRO",
      name: "Agency Pro",
      monthlyPriceInr: 2999,
      yearlyPriceInr: 29990,
      clientQuota: 9,
    },
    {
      code: "ENTERPRISE",
      name: "Enterprise",
      monthlyPriceInr: 0,
      yearlyPriceInr: 0,
      clientQuota: 100,
      isCustom: true,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }

  await prisma.systemSetting.upsert({
    where: { key: "branding" },
    update: {},
    create: {
      key: "branding",
      value: {
        platformName: "SR Social Hub",
        primaryColor: "#7565FF",
        secondaryColor: "#22D3EE",
        themeDefault: "dark",
      },
    },
  });

  const adminEmail = (process.env.SUPER_ADMIN_EMAIL ?? "admin@srsocialhub.local").toLowerCase();
  const agencyEmail = (process.env.DEMO_COMPANY_EMAIL ?? "agency@srsocialhub.local").toLowerCase();
  const clientEmail = (process.env.DEMO_CLIENT_EMAIL ?? "client@srsocialhub.local").toLowerCase();

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      fullName: "SR Super Admin",
      globalRole: GlobalRole.SUPER_ADMIN,
      passwordHash: await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD ?? "ChangeMeAdmin!123", 10),
    },
  });

  const agencyUser = await prisma.user.upsert({
    where: { email: agencyEmail },
    update: {},
    create: {
      email: agencyEmail,
      fullName: "Asha Agency Owner",
      globalRole: GlobalRole.USER,
      passwordHash: await bcrypt.hash(process.env.DEMO_COMPANY_PASSWORD ?? "ChangeMeAgency!123", 10),
    },
  });

  const clientUser = await prisma.user.upsert({
    where: { email: clientEmail },
    update: {},
    create: {
      email: clientEmail,
      fullName: "Rahul Client Approver",
      globalRole: GlobalRole.USER,
      passwordHash: await bcrypt.hash(process.env.DEMO_CLIENT_PASSWORD ?? "ChangeMeClient!123", 10),
    },
  });

  const growth = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { code: "GROWTH" } });

  const company = await prisma.company.upsert({
    where: { slug: "demo-agency" },
    update: {},
    create: {
      name: "Demo Agency",
      slug: "demo-agency",
      status: "TRIAL",
      timezone: "Asia/Kolkata",
      trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      planId: growth.id,
    },
  });

  await prisma.companyMember.upsert({
    where: { companyId_userId: { companyId: company.id, userId: agencyUser.id } },
    update: { role: CompanyRole.OWNER, status: "ACTIVE" },
    create: {
      companyId: company.id,
      userId: agencyUser.id,
      role: CompanyRole.OWNER,
      status: "ACTIVE",
      acceptedAt: new Date(),
    },
  });

  const client = await prisma.client.upsert({
    where: {
      companyId_externalCode: { companyId: company.id, externalCode: "CLIENT-001" },
    },
    update: {},
    create: {
      companyId: company.id,
      name: "Bright Retail",
      externalCode: "CLIENT-001",
      industry: "Retail",
      timezone: "Asia/Kolkata",
      contactEmail: clientEmail,
      brandVoice: "Friendly, concise, conversion-focused",
    },
  });

  await prisma.clientMember.upsert({
    where: { clientId_userId: { clientId: client.id, userId: clientUser.id } },
    update: { role: ClientRole.APPROVER, status: "ACTIVE" },
    create: {
      clientId: client.id,
      userId: clientUser.id,
      role: ClientRole.APPROVER,
      status: "ACTIVE",
      acceptedAt: new Date(),
    },
  });

  const existingSub = await prisma.subscription.findFirst({ where: { companyId: company.id } });
  if (!existingSub) {
    const trialEndsAt =
      company.trialEndsAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.subscription.create({
      data: {
        companyId: company.id,
        planId: growth.id,
        status: "TRIALING",
        interval: "MONTHLY",
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEndsAt,
        trialEndsAt,
        provider: "mock",
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log("Seed complete", {
    admin: admin.email,
    agency: agencyUser.email,
    client: clientUser.email,
    companyId: company.id,
    clientId: client.id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
