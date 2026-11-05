export function profileHrefFromPath(pathname: string): string {
  if (pathname.startsWith("/admin")) return "/admin/profile";
  const app = pathname.match(/^\/app\/([^/]+)/);
  if (app) return `/app/${app[1]}/profile`;
  const client = pathname.match(/^\/client\/([^/]+)/);
  if (client) return `/client/${client[1]}/profile`;
  return "/login";
}

export function firstLetter(name?: string | null) {
  const trimmed = (name || "").trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "U";
}
