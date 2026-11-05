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
  PINTEREST = "PINTEREST",
  THREADS = "THREADS",
}

export const DESIGN_TOKENS = {
  dark: {
    background: "#0C1110",
    sidebar: "#121A18",
    card: "#17201D",
    elevated: "#1E2A26",
    primary: "#E8A54B",
    secondary: "#3DDC97",
    success: "#3DDC97",
    warning: "#F0C14A",
    error: "#FF6B6B",
    text: "#F4F1EA",
    muted: "#9AA8A1",
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
