export class ApiError extends Error {
  code?: string;
  status: number;
  fields?: Record<string, string>;

  constructor(message: string, status: number, code?: string, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "sociallink",
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new ApiError(data?.message ?? "Request failed", response.status, data?.error, data?.fields);
  }
  return data as T;
}

export type Plan = {
  code: string;
  name: string;
  description: string;
  pricePaise: number | null;
  annualPricePaise: number | null;
  pricesIncludeTax: boolean;
  limits: {
    clientProfiles: number | null;
    connectedAccounts: number | null;
    postTargetsPerMonth: number | null;
    teamMembers: number | null;
    exactClientCap: boolean;
    negotiated: boolean;
  };
  features: string[];
};

export type ThemeTokens = {
  brandName: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  fontFamily: string;
  fontSizeBase: string;
  radius: string;
  buttonStyle: string;
  colorMode: string;
  primaryForeground: string;
  secondaryForeground: string;
  accentForeground: string;
};

export type Me = {
  id: string;
  email: string;
  name: string;
  superAdmin: boolean;
  mfaEnabled: boolean;
  workspaceId?: string | null;
  role?: string | null;
};
