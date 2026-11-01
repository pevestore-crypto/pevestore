import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ThemeScript } from "@/components/theme/theme-script";
import { site } from "@/lib/config/site";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  variable: "--font-sans-family",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} — ${site.tagline}`, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  openGraph: { type: "website", locale: "es_DO", siteName: site.name },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-DO" className={`${sans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
