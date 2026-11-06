export type PublicPlan = {
  id: string;
  code: string;
  name: string;
  monthlyPriceInr: number;
  yearlyPriceInr: number | null;
  clientQuota: number;
  accountQuota: number;
  teamQuota: number;
  aiQuota: number;
  storageMb: number;
  isCustom: boolean;
  isActive: boolean;
};

export type PublicPricing = {
  trial: {
    days: number;
    clientQuota: number;
    accountQuota: number;
    priceInr: number;
  };
  plans: PublicPlan[];
};

export type LandingPlanCard = {
  name: string;
  price: string;
  detail: string;
  blurb: string;
  perks: string[];
  highlight: boolean;
  badge: string | null;
};

const FALLBACK_PRICING: PublicPricing = {
  trial: { days: 7, clientQuota: 1, accountQuota: 2, priceInr: 0 },
  plans: [],
};

export async function fetchPublicPricing(): Promise<PublicPricing> {
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const res = await fetch(`${api}/api/v1/public/pricing`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return FALLBACK_PRICING;
    const data = (await res.json()) as PublicPricing;
    return {
      trial: {
        days: Math.max(1, Number(data.trial?.days ?? 7)),
        clientQuota: Math.max(1, Number(data.trial?.clientQuota ?? 1)),
        accountQuota: Math.max(1, Number(data.trial?.accountQuota ?? 2)),
        priceInr: 0,
      },
      plans: Array.isArray(data.plans) ? data.plans : [],
    };
  } catch {
    return FALLBACK_PRICING;
  }
}

export function buildLandingPlanCards(pricing: PublicPricing): LandingPlanCard[] {
  const { trial, plans } = pricing;
  const cards: LandingPlanCard[] = [
    {
      name: "Free trial",
      price: "₹0",
      detail: `${trial.days} days · ${trial.clientQuota} client${trial.clientQuota === 1 ? "" : "s"}`,
      blurb: "Taste the full approval → publish loop before you commit.",
      perks: [
        `${trial.clientQuota} client profile${trial.clientQuota === 1 ? "" : "s"}`,
        `Up to ${trial.accountQuota} social connection${trial.accountQuota === 1 ? "" : "s"}`,
        "Client approvals on-platform",
        "Compose + publish during trial",
      ],
      highlight: false,
      badge: "Start here",
    },
  ];

  const sorted = [...plans].sort((a, b) => {
    if (a.isCustom !== b.isCustom) return a.isCustom ? 1 : -1;
    return a.monthlyPriceInr - b.monthlyPriceInr;
  });

  const popularCode =
    sorted.find((p) => !p.isCustom && p.monthlyPriceInr > 0)?.code === "STARTER"
      ? sorted.find((p) => p.code === "GROWTH")?.code ??
        sorted.find((p) => !p.isCustom && p.monthlyPriceInr > 499)?.code
      : sorted.find((p) => !p.isCustom && p.monthlyPriceInr > 0)?.code;

  for (const plan of sorted) {
    const allNetworks = plan.accountQuota >= 7;
    const highlight = plan.code === (popularCode ?? "GROWTH");
    cards.push({
      name: plan.name.replace(/^Custom.*/i, "Custom") || plan.code,
      price: plan.isCustom ? "Let's talk" : `₹${plan.monthlyPriceInr}`,
      detail: plan.isCustom
        ? "Negotiate quota"
        : `${plan.clientQuota} clients · ${
            allNetworks ? "everything unlocked" : `any ${plan.accountQuota} socials`
          }`,
      blurb: plan.isCustom
        ? "Larger agencies — seats, socials, and limits tailored with us."
        : allNetworks
          ? "Full platform — networks, approvals, analytics, and room to scale."
          : "Lean teams who need speed without opening every network yet.",
      perks: plan.isCustom
        ? [
            "Client seats by agreement",
            "All networks available",
            "Everything unlocked",
            "Priority onboarding help",
          ]
        : [
            `${plan.clientQuota} client profiles`,
            allNetworks
              ? "All 7 social networks"
              : `Any ${plan.accountQuota} social networks`,
            "Client approvals + feedback",
            "Multi-network compose & schedule",
            allNetworks ? "Full analytics pulse + media library" : "Basic publishing pulse",
          ],
      highlight,
      badge: highlight ? "Most popular" : null,
    });
  }

  return cards;
}
