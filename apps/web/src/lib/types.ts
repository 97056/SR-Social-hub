/** Local auth types for the web app (Hostinger deploys apps/web without the monorepo workspace). */

export interface AuthSessionUser {
  id: string;
  email: string;
  fullName: string;
  globalRole: "SUPER_ADMIN" | "USER";
}

export interface LoginResponse {
  accessToken: string;
  user: AuthSessionUser;
  workspaces: {
    isSuperAdmin: boolean;
    companies: Array<{ id: string; name: string; role: string }>;
    clients: Array<{ id: string; name: string; companyId: string; role: string }>;
  };
  redirectTo: string;
}
