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
  | "admin";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIcon;
  color: string;
};

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
  ];
}

export function companyNav(companyId: string): NavItem[] {
  return [
    { href: `/app/${companyId}/dashboard`, label: "Dashboard", icon: "dashboard", color: "#00D2FF" },
    { href: `/app/${companyId}/command-center`, label: "Command Center", icon: "command", color: "#C026FF" },
    { href: `/app/${companyId}/clients`, label: "Clients", icon: "clients", color: "#7B5CFF" },
    { href: `/app/${companyId}/social-accounts`, label: "Social Accounts", icon: "social", color: "#3DDC97" },
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
  ];
}

export function clientNav(clientId: string): NavItem[] {
  return [
    { href: `/client/${clientId}/dashboard`, label: "Client Dashboard", icon: "dashboard", color: "#00D2FF" },
    { href: `/client/${clientId}/social-accounts`, label: "Social Accounts", icon: "social", color: "#3DDC97" },
    { href: `/client/${clientId}/approvals`, label: "Content for Approval", icon: "approvals", color: "#FFB020" },
    { href: `/client/${clientId}/posts`, label: "Posted content", icon: "posts", color: "#C026FF" },
    { href: `/client/${clientId}/settings`, label: "Profile and Settings", icon: "settings", color: "#9AA3B8" },
  ];
}
