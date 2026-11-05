/** Local auth types for the web app (Hostinger deploys apps/web without the monorepo workspace). */

export interface AuthSessionUser {
  id: string;
  userCode?: string | null;
  email: string;
  fullName: string;
  globalRole: "SUPER_ADMIN" | "USER";
  phone?: string | null;
  accountKind?: string | null;
  emailVerifiedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string | null;
  isActive?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  user: AuthSessionUser;
  workspaces: {
    isSuperAdmin: boolean;
    companies: Array<{ id: string; name: string; role: string }>;
    clients: Array<{ id: string; name: string; companyId: string; role: string }>;
  };
  redirectTo: string;
}
