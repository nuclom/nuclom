import { Analytics } from '@vercel/analytics/next';
import type { Metadata, Viewport } from 'next';
import { ThemeProvider } from 'next-themes';
import type React from 'react';
import './globals.css';
import process from 'node:process';

const siteUrl = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
  : 'http://localhost:3092';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Nuclom - Video Collaboration Platform',
    template: '%s | Nuclom',
  },
  description:
    'Streamline your video workflow with real-time collaboration, AI-powered transcription, and seamless sharing. Nuclom helps teams collaborate on video content like never before.',
  keywords: [
    'video collaboration',
    'video platform',
    'team collaboration',
    'video transcription',
    'AI video analysis',
    'video sharing',
    'meeting recordings',
    'video comments',
    'enterprise video',
    'video management',
  ],
  authors: [{ name: 'Nuclom' }],
  creator: 'Nuclom',
  publisher: 'Nuclom',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32', type: 'image/x-icon' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Nuclom',
    title: 'Nuclom - Video Collaboration Platform',
    description:
      'Streamline your video workflow with real-time collaboration, AI-powered transcription, and seamless sharing.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nuclom - Video Collaboration Platform',
    description:
      'Streamline your video workflow with real-time collaboration, AI-powered transcription, and seamless sharing.',
    creator: '@nuclom',
  },
  alternates: {
    canonical: siteUrl,
  },
  category: 'technology',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0d0f17' },
  ],
  width: 'device-width',
  initialScale: 1,
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
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
