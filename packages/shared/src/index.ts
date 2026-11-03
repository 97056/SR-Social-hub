export enum GlobalRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  USER = "USER",
}

export enum CompanyRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  MEMBER = "MEMBER",
  APPROVER = "APPROVER",
}

export enum ClientRole {
  OWNER = "OWNER",
  APPROVER = "APPROVER",
  VIEWER = "VIEWER",
}

export enum MembershipStatus {
  ACTIVE = "ACTIVE",
  INVITED = "INVITED",
  SUSPENDED = "SUSPENDED",
}

export enum CompanyStatus {
  TRIAL = "TRIAL",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
  CANCELLED = "CANCELLED",
}

export enum SocialPlatformCode {
  FACEBOOK = "FACEBOOK",
  INSTAGRAM = "INSTAGRAM",
  LINKEDIN = "LINKEDIN",
  X = "X",
  YOUTUBE = "YOUTUBE",
  TIKTOK = "TIKTOK",
  PINTEREST = "PINTEREST",
  THREADS = "THREADS",
  GOOGLE_BUSINESS = "GOOGLE_BUSINESS",
}

export const DESIGN_TOKENS = {
  dark: {
    background: "#080D19",
    sidebar: "#0B1220",
    card: "#111A2B",
    elevated: "#162136",
    primary: "#7565FF",
    secondary: "#22D3EE",
    success: "#34D399",
    warning: "#FBBF24",
    error: "#FB7185",
    text: "#F8FAFC",
    muted: "#94A3B8",
  },
} as const;

export type AuthWorkspaceKind = "admin" | "company" | "client";

export interface AuthSessionUser {
  id: string;
  email: string;
  fullName: string;
  globalRole: GlobalRole;
}

export interface AuthMembershipSummary {
  companyId?: string;
  companyName?: string;
  companyRole?: CompanyRole;
  clientId?: string;
  clientName?: string;
  clientRole?: ClientRole;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthSessionUser;
  workspaces: {
    isSuperAdmin: boolean;
    companies: Array<{ id: string; name: string; role: CompanyRole }>;
    clients: Array<{ id: string; name: string; companyId: string; role: ClientRole }>;
  };
  redirectTo: string;
}
