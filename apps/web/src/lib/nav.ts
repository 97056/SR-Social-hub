export type NavIcon =
  | "dashboard"
  | "command"
  | "clients"
  | "social"
  | "media"
  | "create"
  | "posts"
  | "approvals"
  | "publishing"
  | "billing"
  | "analytics"
  | "notifications"
  | "team"
  | "settings"
  | "companies"
  | "integrations"
  | "plans"
  | "branding"
  | "faqs"
  | "leads"
  | "mail"
  | "admin"
  | "growth"
  | "seo";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  color: string;
  /** When set, shell renders this as a section heading before the item. */
  section?: string;
};

const GROWTH = "#7CFFB2";
const GROWTH_SECTION = "AI GROWTH CENTER";

/** Hide Growth Center links when Super Admin turns the feature off. Admin settings page stays. */
export function filterGrowthNav(nav: NavItem[], growthCenterEnabled: boolean): NavItem[] {
  if (growthCenterEnabled) return nav;
  return nav.filter((item) => {
    if (item.href === "/admin/growth") return true;
    return !item.href.includes("/growth");
  });
}

export function adminNav(): NavItem[] {
  return [
    { href: "/admin", label: "Admin Dashboard", icon: "admin", color: "#00D2FF" },
    { href: "/admin/companies", label: "Companies", icon: "companies", color: "#7B5CFF" },
    { href: "/admin/integrations", label: "Social Integrations", icon: "integrations", color: "#C026FF" },
    { href: "/admin/plans", label: "Subscription Plans", icon: "plans", color: "#F0C14A" },
    { href: "/admin/billing", label: "Billing Overview", icon: "billing", color: "#3DDC97" },
    { href: "/admin/payments", label: "Payments", icon: "billing", color: "#F0C14A" },
    { href: "/admin/branding", label: "CMS and Branding", icon: "branding", color: "#FF6B6B" },
    { href: "/admin/faqs", label: "Support FAQs", icon: "faqs", color: "#00D2FF" },
    { href: "/admin/contact-leads", label: "Contact Leads", icon: "leads", color: "#FFB020" },
    { href: "/admin/mail", label: "Mail & SMS", icon: "mail", color: "#C026FF" },
    { href: "/admin/settings", label: "System Settings", icon: "settings", color: "#9AA3B8" },
    {
      href: "/admin/growth",
      label: "AI Growth Center",
      icon: "growth",
      color: GROWTH,
      section: GROWTH_SECTION,
    },
  ];
}

export function companyNav(companyId: string): NavItem[] {
  const g = `/app/${companyId}/growth`;
  return [
    { href: `/app/${companyId}/dashboard`, label: "Dashboard", icon: "dashboard", color: "#00D2FF" },
    { href: `/app/${companyId}/command-center`, label: "Command Center", icon: "command", color: "#C026FF" },
    { href: `/app/${companyId}/clients`, label: "Clients", icon: "clients", color: "#7B5CFF" },
    { href: `/app/${companyId}/social-accounts`, label: "Social Accounts", icon: "social", color: "#3DDC97" },
    { href: `/app/${companyId}/seo-workspace`, label: "SEO Workspace", icon: "seo", color: "#00D2FF" },
    { href: `/app/${companyId}/media`, label: "Media Library", icon: "media", color: "#FF6B6B" },
    { href: `/app/${companyId}/create`, label: "Create Post", icon: "create", color: "#F0C14A" },
    { href: `/app/${companyId}/posts`, label: "Posts", icon: "posts", color: "#00D2FF" },
    { href: `/app/${companyId}/approvals`, label: "Approval Inbox", icon: "approvals", color: "#FFB020" },
    { href: `/app/${companyId}/publishing`, label: "Publishing Queue", icon: "publishing", color: "#C026FF" },
    { href: `/app/${companyId}/billing`, label: "Billing", icon: "billing", color: "#3DDC97" },
    { href: `/app/${companyId}/analytics`, label: "Analytics", icon: "analytics", color: "#7B5CFF" },
    { href: `/app/${companyId}/notifications`, label: "Notifications", icon: "notifications", color: "#FF6B6B" },
    { href: `/app/${companyId}/team`, label: "Team Members", icon: "team", color: "#00D2FF" },
    { href: `/app/${companyId}/settings`, label: "Settings", icon: "settings", color: "#9AA3B8" },
    { href: g, label: "Overview", icon: "growth", color: GROWTH, section: GROWTH_SECTION },
    { href: `${g}/business`, label: "Business Consultant", icon: "growth", color: "#00D2FF" },
    { href: `${g}/marketing`, label: "Marketing Expert", icon: "growth", color: "#C026FF" },
    { href: `${g}/partner`, label: "Growth Partner", icon: "growth", color: "#7B5CFF" },
    { href: `${g}/opportunities`, label: "Opportunity Inbox", icon: "approvals", color: "#FFB020" },
    { href: `${g}/plans`, label: "Growth Plans", icon: "plans", color: "#F0C14A" },
    { href: `${g}/tasks`, label: "Tasks & Execution", icon: "posts", color: "#3DDC97" },
    { href: `${g}/results`, label: "Results Tracker", icon: "analytics", color: "#00D2FF" },
    { href: `${g}/reports`, label: "Reports", icon: "media", color: "#FF6B6B" },
    { href: `${g}/settings`, label: "AI Settings & Usage", icon: "settings", color: "#9AA3B8" },
  ];
}

export function clientNav(clientId: string): NavItem[] {
  const g = `/client/${clientId}/growth`;
  return [
    { href: `/client/${clientId}/dashboard`, label: "Client Dashboard", icon: "dashboard", color: "#00D2FF" },
    { href: `/client/${clientId}/social-accounts`, label: "Social Accounts", icon: "social", color: "#3DDC97" },
    { href: `/client/${clientId}/approvals`, label: "Content for Approval", icon: "approvals", color: "#FFB020" },
    { href: `/client/${clientId}/posts`, label: "Posted content", icon: "posts", color: "#C026FF" },
    { href: `/client/${clientId}/settings`, label: "Profile and Settings", icon: "settings", color: "#9AA3B8" },
    { href: g, label: "Growth Overview", icon: "growth", color: GROWTH, section: GROWTH_SECTION },
    { href: `${g}/profile`, label: "Business Profile", icon: "clients", color: "#00D2FF" },
    { href: `${g}/opportunities`, label: "Opportunities", icon: "approvals", color: "#FFB020" },
    { href: `${g}/plans`, label: "Growth Plans", icon: "plans", color: "#F0C14A" },
    { href: `${g}/tasks`, label: "My Tasks", icon: "posts", color: "#3DDC97" },
    { href: `${g}/results`, label: "Results", icon: "analytics", color: "#00D2FF" },
    { href: `${g}/reports`, label: "Reports", icon: "media", color: "#FF6B6B" },
  ];
}
