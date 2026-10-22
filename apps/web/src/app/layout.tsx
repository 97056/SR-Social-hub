import type { Metadata } from "next";
import { IBM_Plex_Sans, Inter, Nunito_Sans, Source_Sans_3 } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const sourceSans = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-ibm-plex" });
const nunito = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito" });

export const metadata: Metadata = {
  title: "SR Social hub",
  description: "All Your Socials. One Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sourceSans.variable} ${inter.variable} ${plex.variable} ${nunito.variable}`}>
        <ThemeProvider>
          <SiteHeader />
          <main id="content">{children}</main>
          <SiteFooter />
        </ThemeProvider>
      </body>
    </html>
  );
}
