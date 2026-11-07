import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

type Entry = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
};

/**
 * Every public, indexable route on the site.
 * Auth-walled areas (/app, /admin dashboards, /client) stay out — robots.txt
 * blocks them and they need session/IDs, so listing them hurts SEO.
 */
const PUBLIC_PAGES: Entry[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/login", changeFrequency: "monthly", priority: 0.8 },
  { path: "/register", changeFrequency: "monthly", priority: 0.9 },
  { path: "/activate", changeFrequency: "monthly", priority: 0.5 },
  { path: "/forgot-password", changeFrequency: "yearly", priority: 0.3 },
  { path: "/reset-password", changeFrequency: "yearly", priority: 0.3 },
  { path: "/support", changeFrequency: "weekly", priority: 0.7 },
  { path: "/integrations", changeFrequency: "weekly", priority: 0.7 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.6 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.6 },
  { path: "/delete-account", changeFrequency: "monthly", priority: 0.5 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_PAGES.map(({ path, changeFrequency, priority }) => ({
    url: path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
