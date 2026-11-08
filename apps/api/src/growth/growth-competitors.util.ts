/** Industry-mapped real competitor suggestions for Growth Center auto-fill. */

export type CompetitorSuggestion = {
  name: string;
  website: string;
  reason: string;
};

type CatalogEntry = {
  match: RegExp;
  label: string;
  competitors: Array<{ name: string; website: string }>;
};

const CATALOGS: CatalogEntry[] = [
  {
    match:
      /\b(career|job|placement|interview|aptitude|coding|exam|gate|upsc|ssc|bank exam|campus|freshers?|path2career|coaching|edtech|course|training|learning)\b/i,
    label: "Career / edtech / exam prep",
    competitors: [
      { name: "Unacademy", website: "https://unacademy.com" },
      { name: "Testbook", website: "https://testbook.com" },
      { name: "Adda247", website: "https://www.adda247.com" },
      { name: "GeeksforGeeks", website: "https://www.geeksforgeeks.org" },
      { name: "Scaler", website: "https://www.scaler.com" },
      { name: "Physics Wallah", website: "https://www.pw.live" },
      { name: "Internshala", website: "https://internshala.com" },
      { name: "Naukri Campus", website: "https://www.naukri.com/campus" },
    ],
  },
  {
    match: /\b(grocery|kirana|supermarket|fresh produce|vegetables|dairy|essentials|bazar|bazaar)\b/i,
    label: "Grocery / retail essentials",
    competitors: [
      { name: "BigBasket", website: "https://www.bigbasket.com" },
      { name: "Blinkit", website: "https://blinkit.com" },
      { name: "Zepto", website: "https://www.zeptonow.com" },
      { name: "JioMart", website: "https://www.jiomart.com" },
      { name: "Amazon Fresh", website: "https://www.amazon.in/fresh" },
    ],
  },
  {
    match: /\b(real estate|property|housing|flat|apartment|builder)\b/i,
    label: "Real estate",
    competitors: [
      { name: "99acres", website: "https://www.99acres.com" },
      { name: "Magicbricks", website: "https://www.magicbricks.com" },
      { name: "Housing.com", website: "https://housing.com" },
      { name: "NoBroker", website: "https://www.nobroker.in" },
    ],
  },
  {
    match: /\b(fashion|apparel|clothing|boutique|ethnic wear|saree)\b/i,
    label: "Fashion & apparel",
    competitors: [
      { name: "Myntra", website: "https://www.myntra.com" },
      { name: "Ajio", website: "https://www.ajio.com" },
      { name: "Nykaa Fashion", website: "https://www.nykaafashion.com" },
      { name: "Meesho", website: "https://www.meesho.com" },
    ],
  },
  {
    match: /\b(food|restaurant|cafe|cloud kitchen|biryani|delivery)\b/i,
    label: "Food & hospitality",
    competitors: [
      { name: "Swiggy", website: "https://www.swiggy.com" },
      { name: "Zomato", website: "https://www.zomato.com" },
      { name: "Magicpin", website: "https://magicpin.in" },
      { name: "EatSure", website: "https://www.eatsure.com" },
    ],
  },
  {
    match: /\b(saas|software|crm|b2b|platform|app|fintech|payment)\b/i,
    label: "Software / SaaS",
    competitors: [
      { name: "Zoho", website: "https://www.zoho.com" },
      { name: "Freshworks", website: "https://www.freshworks.com" },
      { name: "HubSpot", website: "https://www.hubspot.com" },
      { name: "Salesforce", website: "https://www.salesforce.com" },
    ],
  },
  {
    match: /\b(agency|digital marketing|social media marketing|seo agency|ads agency)\b/i,
    label: "Marketing agency",
    competitors: [
      { name: "Social Beat", website: "https://www.socialbeat.in" },
      { name: "Webchutney", website: "https://www.webchutney.com" },
      { name: "Schbang", website: "https://www.schbang.com" },
      { name: "Gozoop", website: "https://www.gozoop.com" },
    ],
  },
  {
    match: /\b(health|clinic|wellness|fitness|gym|hospital|ayurveda)\b/i,
    label: "Health & wellness",
    competitors: [
      { name: "Practo", website: "https://www.practo.com" },
      { name: "1mg", website: "https://www.1mg.com" },
      { name: "Cult.fit", website: "https://www.cult.fit" },
      { name: "HealthifyMe", website: "https://www.healthifyme.com" },
    ],
  },
];

const FALLBACK: CompetitorSuggestion[] = [
  {
    name: "Category marketplace leaders",
    website: "https://www.google.com/search?q=competitors",
    reason: "Generic search pressure from larger brands in your category",
  },
  {
    name: "Regional specialists",
    website: "https://www.google.com/search?q=local+business+competitors",
    reason: "Local players competing on trust and response speed",
  },
  {
    name: "Social-first challenger brands",
    website: "https://www.instagram.com",
    reason: "Brands winning attention on Instagram / YouTube in your niche",
  },
  {
    name: "Creator / influencer substitutes",
    website: "https://www.youtube.com",
    reason: "Creators who capture discovery even without a full product suite",
  },
];

export function suggestCompetitorsFromSignals(input: {
  industry?: string | null;
  category?: string | null;
  description?: string | null;
  productsServices?: string | null;
  targetAudience?: string | null;
  businessName?: string | null;
  websiteTitle?: string | null;
  websiteDescription?: string | null;
  websiteExcerpt?: string | null;
  htmlLower?: string | null;
}): { category: string; items: CompetitorSuggestion[] } {
  const blob = [
    input.industry,
    input.category,
    input.description,
    input.productsServices,
    input.targetAudience,
    input.businessName,
    input.websiteTitle,
    input.websiteDescription,
    input.websiteExcerpt,
    input.htmlLower,
  ]
    .filter(Boolean)
    .join(" ");

  const html = (input.htmlLower || "").toLowerCase();
  const catalog = CATALOGS.find((c) => c.match.test(blob)) || null;

  if (!catalog) {
    return { category: "General", items: FALLBACK };
  }

  const mentioned: CompetitorSuggestion[] = [];
  const rest: CompetitorSuggestion[] = [];
  for (const c of catalog.competitors) {
    const hit = html.includes(c.name.toLowerCase()) || blob.toLowerCase().includes(c.name.toLowerCase());
    const row: CompetitorSuggestion = {
      name: c.name,
      website: c.website,
      reason: hit
        ? `Mentioned or closely aligned with signals on your site (${catalog.label})`
        : `Common competitor in ${catalog.label} for your positioning`,
    };
    if (hit) mentioned.push(row);
    else rest.push(row);
  }

  const items = [...mentioned, ...rest].slice(0, 6);
  return { category: catalog.label, items };
}

export function formatCompetitorsField(items: CompetitorSuggestion[]): string {
  return items.map((i) => `${i.name} - ${i.website}`).join("\n");
}
