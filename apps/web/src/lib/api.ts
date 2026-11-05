import type { AuthSessionUser, LoginResponse } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sr_access_token");
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sr_refresh_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (!token) {
    localStorage.removeItem("sr_access_token");
    localStorage.removeItem("sr_refresh_token");
    localStorage.removeItem("sr_session_user");
  } else localStorage.setItem("sr_access_token", token);
}

export function setRefreshToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (!token) localStorage.removeItem("sr_refresh_token");
  else localStorage.setItem("sr_refresh_token", token);
}

export function setSessionUser(user: AuthSessionUser | null) {
  if (typeof window === "undefined") return;
  if (!user) localStorage.removeItem("sr_session_user");
  else localStorage.setItem("sr_session_user", JSON.stringify(user));
}

export function getSessionUser(): AuthSessionUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("sr_session_user");
    return raw ? (JSON.parse(raw) as AuthSessionUser) : null;
  } catch {
    return null;
  }
}

export function apiUrl(path: string) {
  return `${API_URL}/api/v1${path}`;
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(apiUrl("/auth/refresh"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "SRSocialHub",
        },
        credentials: "include",
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const body = (await res.json()) as { accessToken?: string; refreshToken?: string };
      if (!body.accessToken) return false;
      setToken(body.accessToken);
      if (body.refreshToken) setRefreshToken(body.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function clearSessionAndRedirect() {
  setToken(null);
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  const login = path.startsWith("/admin") ? "/admin/login" : "/login";
  if (!path.startsWith("/login") && !path.startsWith("/admin/login")) {
    window.location.replace(login);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("X-Requested-With", "SRSocialHub");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(apiUrl(path), {
    ...init,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/admin/login") && path !== "/auth/refresh") {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      const retryHeaders = new Headers(init.headers);
      if (!(init.body instanceof FormData)) {
        retryHeaders.set("Content-Type", "application/json");
      }
      retryHeaders.set("X-Requested-With", "SRSocialHub");
      const next = getToken();
      if (next) retryHeaders.set("Authorization", `Bearer ${next}`);
      const retry = await fetch(apiUrl(path), {
        ...init,
        headers: retryHeaders,
        credentials: "include",
      });
      if (retry.ok) {
        if (retry.status === 204) return undefined as T;
        return retry.json() as Promise<T>;
      }
    }
    clearSessionAndRedirect();
    throw new Error("Session expired. Please sign in again.");
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string | string[]; validation?: unknown };
      if (Array.isArray(body.message)) message = body.message.join(", ");
      else if (body.message) message = body.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function loginRequest(
  email: string,
  password: string,
  admin = false,
): Promise<LoginResponse> {
  const result = await apiFetch<LoginResponse>(admin ? "/auth/admin/login" : "/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (result.refreshToken) setRefreshToken(result.refreshToken);
  return result;
}

export function mediaFileUrl(assetId: string) {
  const token = getToken();
  return apiUrl(`/media/${assetId}/file${token ? `?access_token=${encodeURIComponent(token)}` : ""}`);
}
