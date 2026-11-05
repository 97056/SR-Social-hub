import {
  GlobalRole,
  PrismaClient,
  SocialPlatformCode,
} from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { allocateUserCode } from "../src/common/user-code.util";

const prisma = new PrismaClient();

async function main() {
  const platforms: Array<{ code: SocialPlatformCode; name: string }> = [
    { code: "FACEBOOK", name: "Facebook" },
    { code: "INSTAGRAM", name: "Instagram" },
    { code: "LINKEDIN", name: "LinkedIn" },
    { code: "X", name: "X" },
    { code: "YOUTUBE", name: "YouTube" },
    { code: "PINTEREST", name: "Pinterest" },
    { code: "THREADS", name: "Threads" },
  ];

  for (const platform of platforms) {
    await prisma.socialPlatform.upsert({
      where: { code: platform.code },
      update: { name: platform.name, enabled: true },
      create: { ...platform, enabled: true },
    });
  }

  // Legacy platforms removed from product — keep any DB rows disabled.
  await prisma.socialPlatform.updateMany({
    where: { code: "TIKTOK" },
    data: { enabled: false, name: "TikTok (unavailable)" },
  });
  await prisma.socialPlatform.updateMany({
    where: { code: "GOOGLE_BUSINESS" },
    data: { enabled: false, name: "Google Business Profile (unavailable)" },
  });

  const plans = [
    {
      code: "STARTER",
      name: "Starter · 3 clients",
      monthlyPriceInr: 499,
      yearlyPriceInr: 4990,
      clientQuota: 3,
      accountQuota: 3,
      teamQuota: 3,
      aiQuota: 50,
      storageMb: 1024,
      isCustom: false,
      entitlements: {
        maxSocialNetworks: 3,
        allNetworks: false,
        clientApprovals: true,
        multiPublish: true,
        analytics: "basic",
        note: "Any 3 social networks of your choice",
      },
    },
    {
      code: "GROWTH",
      name: "Growth · 6 clients",
      monthlyPriceInr: 999,
      yearlyPriceInr: 9990,
      clientQuota: 6,
      accountQuota: 50,
      teamQuota: 8,
      aiQuota: 200,
      storageMb: 5120,
      isCustom: false,
      entitlements: {
        maxSocialNetworks: 7,
        allNetworks: true,
        clientApprovals: true,
        multiPublish: true,
        analytics: "full",
        note: "All networks + full platform features",
      },
    },
    {
      code: "AGENCY_PRO",
      name: "Agency Pro · 9 clients",
      monthlyPriceInr: 1499,
      yearlyPriceInr: 14990,
      clientQuota: 9,
      accountQuota: 100,
      teamQuota: 15,
      aiQuota: 500,
      storageMb: 10240,
      isCustom: false,
      entitlements: {
        maxSocialNetworks: 7,
        allNetworks: true,
        clientApprovals: true,
        multiPublish: true,
        analytics: "full",
        note: "Everything in Growth with more client seats",
      },
    },
    {
      code: "ENTERPRISE",
      name: "Custom · negotiate quota",
      monthlyPriceInr: 0,
      yearlyPriceInr: 0,
      clientQuota: 100,
      accountQuota: 500,
      teamQuota: 50,
      aiQuota: 2000,
      storageMb: 51200,
      isCustom: true,
      entitlements: {
        maxSocialNetworks: 7,
        allNetworks: true,
        clientApprovals: true,
        multiPublish: true,
        analytics: "full",
        note: "Custom client + social quotas",
      },
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
    update: {
      value: {
        platformName: "SR Social Hub",
        primaryColor: "#00D2FF",
        secondaryColor: "#C026FF",
        logoUrl: "/brand/logo.png",
        faviconUrl: "/brand/favicon.png",
        loginHeadline: "All your socials. One command center.",
        loginSubcopy:
          "Agency workspaces, client approvals, and multi-network publishing from one neon-bright hub.",
        supportEmail: "support@srsocialhub.local",
        themeDefault: "dark",
      },
    },
    create: {
      key: "branding",
      value: {
        platformName: "SR Social Hub",
        primaryColor: "#00D2FF",
        secondaryColor: "#C026FF",
        logoUrl: "/brand/logo.png",
        faviconUrl: "/brand/favicon.png",
        loginHeadline: "All your socials. One command center.",
        loginSubcopy:
          "Agency workspaces, client approvals, and multi-network publishing from one neon-bright hub.",
        supportEmail: "support@srsocialhub.local",
        themeDefault: "dark",
      },
    },
  });

  const faqItems = [
    {
      id: "faq-trial",
      question: "What do I get during the 7-day free trial?",
      answer:
        "Trial unlocks the full approval -> publish workflow with 1 client profile and up to 2 social connections so you can feel the speed before you subscribe.",
      published: true,
      sortOrder: 1,
    },
    {
      id: "faq-starter-socials",
      question: "How many social networks can I connect on Starter (Rs.499)?",
      answer:
        "Starter includes 3 client profiles and any 3 social networks of your choice. Upgrade to Growth (Rs.999) to unlock all seven networks and full platform features.",
      published: true,
      sortOrder: 2,
    },
    {
      id: "faq-approvals",
      question: "How do client approvals work inside the platform?",
      answer:
        "Your team submits drafts for review. Clients open a focused portal, leave feedback, and approve — without ever seeing credentials or billing. Approved posts move straight into the publishing queue.",
      published: true,
      sortOrder: 3,
    },
    {
      id: "faq-publish",
      question: "Can I publish one post to multiple networks?",
      answer:
        "Yes. Compose once, tailor media per channel, then schedule or publish live across connected networks based on your plan limits.",
      published: true,
      sortOrder: 4,
    },
    {
      id: "faq-billing",
      question: "Who controls plans and quotas?",
      answer:
        "Super Admin assigns plans, negotiates custom quota, and manages pricing. Agencies see their entitlements on Billing but cannot change plan pricing themselves.",
      published: true,
      sortOrder: 5,
    },
    {
      id: "faq-delete",
      question: "How do I delete my account or request data removal?",
      answer:
        "Use the Delete account page (/delete-account) or email privacy@srsocialhub.local. We’ll process deletion requests according to our Privacy Policy.",
      published: true,
      sortOrder: 6,
    },
  ];

  await prisma.systemSetting.upsert({
    where: { key: "faqs" },
    update: { value: { items: faqItems } },
    create: { key: "faqs", value: { items: faqItems } },
  });

  await prisma.systemSetting.upsert({
    where: { key: "mail" },
    update: {},
    create: {
      key: "mail",
      value: {
        provider: "smtp",
        smtpHost: process.env.SMTP_HOST || "smtp.gmail.com",
        smtpPort: Number(process.env.SMTP_PORT || 587),
        smtpSecure: String(process.env.SMTP_SECURE || "false") === "true",
        smtpUser: process.env.SMTP_USER || "",
        smtpPass: process.env.SMTP_PASS || "",
        fromEmail: process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || "",
        fromName: process.env.SMTP_FROM_NAME || "SR Social Hub",
        sendgridApiKey: "",
        twilioAccountSid: "",
        twilioAuthToken: "",
        twilioFromNumber: "",
      },
    },
  });

  const adminEmail = (process.env.SUPER_ADMIN_EMAIL ?? "admin@srsocialhub.local").toLowerCase();

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { isActive: true, emailVerifiedAt: new Date() },
    create: {
      userCode: await allocateUserCode(prisma),
      email: adminEmail,
      fullName: "SR Super Admin",
      globalRole: GlobalRole.SUPER_ADMIN,
      passwordHash: await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD ?? "ChangeMeAdmin!123", 10),
      isActive: true,
      emailVerifiedAt: new Date(),
    },
  });

  // Backfill public User IDs (SRSH-########) for any existing users
  const missingCodes = await prisma.user.findMany({ where: { userCode: null } });
  for (const u of missingCodes) {
    await prisma.user.update({
      where: { id: u.id },
      data: { userCode: await allocateUserCode(prisma) },
    });
  }

  // Remove legacy demo agency / dummy users if present
  const demoCompany = await prisma.company.findUnique({ where: { slug: "demo-agency" } });
  if (demoCompany) {
    await prisma.company.delete({ where: { id: demoCompany.id } });
  }
  for (const email of ["agency@srsocialhub.local", "client@srsocialhub.local"]) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.globalRole !== GlobalRole.SUPER_ADMIN) {
      await prisma.user.delete({ where: { id: user.id } });
    }
  }

  // eslint-disable-next-line no-console
  console.log("Seed complete", {
    admin: admin.email,
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
