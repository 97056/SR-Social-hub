import { NextRequest, NextResponse } from "next/server";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Short in-memory cache so every navigation does not hit the API. */
let cached: { at: number; on: boolean } | null = null;
const CACHE_MS = 10_000;

async function maintenanceOn(): Promise<boolean> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.on;
  try {
    const res = await fetch(`${API}/api/v1/public/status`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      cached = { at: Date.now(), on: false };
      return false;
    }
    const data = (await res.json()) as { maintenanceMode?: boolean };
    const on = Boolean(data.maintenanceMode);
    cached = { at: Date.now(), on };
    return on;
  } catch {
    cached = { at: Date.now(), on: false };
    return false;
  }
}

function isBypass(pathname: string): boolean {
  return (
    pathname === "/maintenance" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/brand") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isBypass(pathname)) return NextResponse.next();

  if (await maintenanceOn()) {
    const url = req.nextUrl.clone();
    url.pathname = "/maintenance";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
