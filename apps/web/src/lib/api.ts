import type { LoginResponse } from "@sr/shared";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("sr_access_token");
}

export function setToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (!token) localStorage.removeItem("sr_access_token");
  else localStorage.setItem("sr_access_token", token);
}

export function apiUrl(path: string) {
  return `${API_URL}/api/v1${path}`;
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
  return apiFetch<LoginResponse>(admin ? "/auth/admin/login" : "/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function mediaFileUrl(assetId: string) {
  const token = getToken();
  return apiUrl(`/media/${assetId}/file${token ? `?access_token=${encodeURIComponent(token)}` : ""}`);
}
