import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const base = process.env.API_URL ?? "http://localhost:4000";

async function login() {
  const res = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "agency@srsocialhub.local",
      password: "ChangeMeAgency!123",
    }),
  });
  if (!res.ok) throw new Error(`login failed ${res.status}`);
  return res.json() as Promise<{
    accessToken: string;
    workspaces: { companies: Array<{ id: string }> };
  }>;
}

async function main() {
  const auth = await login();
  const companyId = auth.workspaces.companies[0].id;

  await prisma.subscription.updateMany({
    where: { companyId },
    data: {
      status: "EXPIRED",
      trialEndsAt: new Date(Date.now() - 86400000),
    },
  });
  await prisma.company.update({
    where: { id: companyId },
    data: { status: "TRIAL", trialEndsAt: new Date(Date.now() - 86400000) },
  });

  const entRes = await fetch(`${base}/api/v1/companies/${companyId}/billing/entitlements`, {
    headers: { Authorization: `Bearer ${auth.accessToken}` },
  });
  const ent = (await entRes.json()) as {
    publishingAllowed: boolean;
    publishingBlockReason: string | null;
  };
  if (ent.publishingAllowed) {
    throw new Error(`expected publishing blocked, got ${JSON.stringify(ent)}`);
  }
  console.log("blocked:", ent.publishingBlockReason);

  const checkout = await fetch(`${base}/api/v1/companies/${companyId}/billing/checkout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ planCode: "GROWTH", interval: "MONTHLY" }),
  });
  if (!checkout.ok) throw new Error(`checkout failed ${checkout.status} ${await checkout.text()}`);
  const body = (await checkout.json()) as {
    entitlements: { publishingAllowed: boolean; subscriptionStatus: string };
  };
  if (!body.entitlements.publishingAllowed || body.entitlements.subscriptionStatus !== "ACTIVE") {
    throw new Error(`restore failed ${JSON.stringify(body.entitlements)}`);
  }
  console.log("restored ACTIVE");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
