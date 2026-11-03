export function adminNav() {
  return [
    { href: "/admin", label: "Admin Dashboard" },
    { href: "/admin/companies", label: "Companies" },
    { href: "/admin/integrations", label: "Social Integrations" },
    { href: "/admin/plans", label: "Subscription Plans" },
    { href: "/admin/billing", label: "Billing Overview" },
    { href: "/admin/branding", label: "CMS and Branding" },
    { href: "/admin/settings", label: "System Settings" },
  ];
}

export function companyNav(companyId: string) {
  return [
    { href: `/app/${companyId}/dashboard`, label: "Dashboard" },
    { href: `/app/${companyId}/command-center`, label: "Command Center" },
    { href: `/app/${companyId}/clients`, label: "Clients" },
    { href: `/app/${companyId}/social-accounts`, label: "Social Accounts" },
    { href: `/app/${companyId}/media`, label: "Media Library" },
    { href: `/app/${companyId}/create`, label: "Create Post" },
    { href: `/app/${companyId}/posts`, label: "Posts" },
    { href: `/app/${companyId}/approvals`, label: "Approval Inbox" },
    { href: `/app/${companyId}/publishing`, label: "Publishing Queue" },
    { href: `/app/${companyId}/billing`, label: "Billing" },
    { href: `/app/${companyId}/analytics`, label: "Analytics" },
    { href: `/app/${companyId}/notifications`, label: "Notifications" },
    { href: `/app/${companyId}/team`, label: "Team Members" },
    { href: `/app/${companyId}/settings`, label: "Settings" },
  ];
}

export function clientNav(clientId: string) {
  return [
    { href: `/client/${clientId}/dashboard`, label: "Client Dashboard" },
    { href: `/client/${clientId}/social-accounts`, label: "Social Accounts" },
    { href: `/client/${clientId}/approvals`, label: "Content for Approval" },
    { href: `/client/${clientId}/settings`, label: "Profile and Settings" },
  ];
}
