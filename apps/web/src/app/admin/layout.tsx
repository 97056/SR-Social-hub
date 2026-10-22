import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SR Social Admin",
  description: "SR Social Admin controls plans, appearance, and provider settings for SR Social hub.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
