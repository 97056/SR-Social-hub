import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { DisableNativeValidation } from "@/components/disable-native-validation";
import { ThemeBoot } from "@/components/theme-boot";
import { ToastProvider } from "@/components/toast";
import { fetchPublicBranding } from "@/lib/branding";
import { dailyKeywords, SITE_AUTHOR, SITE_PUBLISHER, SITE_URL } from "@/lib/seo";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
});
const body = Figtree({
  subsets: ["latin"],
  variable: "--font-body",
});

export async function generateMetadata(): Promise<Metadata> {
  const brand = await fetchPublicBranding();
  const title =
    brand.seoTitle?.trim() ||
    `${brand.platformName} — Agency Social Media Command Center`;
  const description =
    brand.seoDescription?.trim() ||
    brand.loginSubcopy ||
    "All-in-one social media management for agencies — create, approve, and publish across Facebook, Instagram, LinkedIn, X, YouTube, Pinterest, and Threads.";
  const author = brand.seoAuthor?.trim() || SITE_AUTHOR;
  const publisher = brand.seoPublisher?.trim() || SITE_PUBLISHER;
  const keywords = dailyKeywords(brand.seoKeywordPool);

  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      template: `%s | ${brand.platformName}`,
    },
    description,
    keywords,
    authors: [{ name: author, url: SITE_URL }],
    creator: author,
    publisher,
    applicationName: brand.platformName,
    category: "Social Media Management",
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      locale: "en_IN",
      url: SITE_URL,
      siteName: brand.platformName,
      title,
      description,
      images: [
        {
          url: brand.logoUrl.startsWith("http")
            ? brand.logoUrl
            : `${SITE_URL}${brand.logoUrl}`,
          alt: `${brand.platformName} brand mark`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      creator: "@srsocialhub",
    },
    verification: {
      google: "K196_gQOD-QoNrSCxzFlkbMywyT3_ZvwN1Lv1ey2RAQ",
    },
    icons: {
      icon: [{ url: brand.faviconUrl || "/brand/favicon.png", type: "image/png", sizes: "1024x1024" }],
      apple: [{ url: brand.logoUrl || "/brand/logo-mark.png", sizes: "1024x1024" }],
      shortcut: brand.faviconUrl || "/brand/favicon.png",
    },
    other: {
      "msapplication-TileColor": brand.primaryColor || "#00D2FF",
    },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={SITE_URL} />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var u=localStorage.getItem('sr_theme_user');var t=u||localStorage.getItem('sr_theme');if(t==='light'){document.documentElement.classList.add('light');document.documentElement.classList.remove('dark');document.documentElement.dataset.theme='light';}else if(t==='dark'){document.documentElement.classList.add('dark');document.documentElement.classList.remove('light');document.documentElement.dataset.theme='dark';}}catch(e){}`,
          }}
        />
      </head>
      <body className={`${display.variable} ${body.variable}`}>
        <ToastProvider>
          <ThemeBoot />
          <DisableNativeValidation />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
