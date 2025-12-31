import type { Metadata } from "next";
import type React from "react";
import "./globals.css";
import { CookieConsentBanner, CookieSettingsButton } from "@/components/legal/cookie-consent";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Nuclom",
  description: "A video collaboration platform.",
  generator: "v0.dev",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <div className="min-h-screen bg-background text-foreground">{children}</div>
          <Toaster />
          <CookieConsentBanner />
          <CookieSettingsButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
