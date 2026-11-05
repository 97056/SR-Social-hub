import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { DisableNativeValidation } from "@/components/disable-native-validation";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
});
const body = Figtree({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "SR Social Hub",
  description:
    "All-in-one social media management for agencies — create, approve, and publish across Facebook, Instagram, LinkedIn, X, YouTube, Pinterest, and Threads.",
  verification: {
    google: "K196_gQOD-QoNrSCxzFlkbMywyT3_ZvwN1Lv1ey2RAQ",
  },
  icons: {
    icon: [{ url: "/brand/favicon.png", type: "image/png", sizes: "1024x1024" }],
    apple: [{ url: "/brand/logo-mark.png", sizes: "1024x1024" }],
    shortcut: "/brand/favicon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('sr_theme');if(t==='light'){document.documentElement.classList.add('light');document.documentElement.classList.remove('dark');}}catch(e){}`,
          }}
        />
      </head>
      <body className={`${display.variable} ${body.variable}`}>
        <ToastProvider>
          <DisableNativeValidation />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
