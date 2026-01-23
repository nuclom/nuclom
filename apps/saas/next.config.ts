import { withPostHogConfig } from '@posthog/nextjs-config';
import { withMicrofrontends } from '@vercel/microfrontends/next/config';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { withWorkflow } from 'workflow/next';

const withNextIntl = createNextIntlPlugin('./src/lib/i18n/request.ts');

const nextConfig: NextConfig = {
  // Enable Partial Prerendering (PPR) via cache components
  cacheComponents: true,

  // Skip during build - CI handles type checking and linting
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // Memory optimization for Vercel builds
  // Increase timeout for static page generation (default 60s)
  staticPageGenerationTimeout: 300,

  // Optimize barrel file imports for better bundle size and faster builds
  experimental: {
    optimizePackageImports: [
      // Icons
      'lucide-react',
      '@radix-ui/react-icons',
      // UI libraries
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
      // Effect ecosystem
      'effect',
      '@effect/platform',
      '@effect/sql',
      '@effect/sql-drizzle',
      // Utilities
      'date-fns',
      'lodash',
      // Charts
      'recharts',
      // Other heavy packages
      'react-day-picker',
      'react-hook-form',
      'swr',
      'posthog-js',
      'ai',
    ],
    // Reduce parallelism during build to prevent OOM on Vercel
    workerThreads: false,
    cpus: 2,
  },

  // Image optimization configuration
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.gravatar.com' },
      { protocol: 'https', hostname: '*.r2.dev' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
    ],
    minimumCacheTTL: 60,
  },

  compress: true,

  async headers() {
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live https://us-assets.i.posthog.com https://eu-assets.i.posthog.com https://cdn.jsdelivr.net https://browser.sentry-cdn.com https://js.sentry-cdn.com",
      "style-src 'self' 'unsafe-inline' https://d4tuoctqmanu0.cloudfront.net https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://*.gravatar.com https://*.r2.dev https://*.r2.cloudflarestorage.com https://d3gk2c5xim1je2.cloudfront.net https://mintcdn.com https://*.mintcdn.com https://cdn.jsdelivr.net https://mintlify.s3.us-west-1.amazonaws.com https://mintlify.s3-us-west-1.amazonaws.com",
      "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com https://d4tuoctqmanu0.cloudfront.net",
      "connect-src 'self' https://*.r2.cloudflarestorage.com https://api.stripe.com wss://*.nuclom.com https://vitals.vercel-insights.com https://vercel.live wss://ws-us3.pusher.com https://us.i.posthog.com https://eu.i.posthog.com https://*.posthog.com https://*.mintlify.dev https://*.mintlify.com https://d1ctpt7j8wusba.cloudfront.net https://mintcdn.com https://*.mintcdn.com https://api.mintlifytrieve.com https://browser.sentry-cdn.com",
      "media-src 'self' blob: https://*.r2.dev https://*.r2.cloudflarestorage.com",
      "frame-src 'self' https://*.mintlify.dev",
      "frame-ancestors 'self'",
      "form-action 'self'",
      process.env.NODE_ENV === 'production' ? 'upgrade-insecure-requests' : '',
      'block-all-mixed-content',
    ]
      .filter(Boolean)
      .join('; ');

    const securityHeaders = [
      { key: 'Content-Security-Policy', value: cspDirectives },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      {
        key: 'Permissions-Policy',
        value: [
          'camera=(self)',
          'microphone=(self)',
          'geolocation=()',
          'interest-cohort=()',
          'payment=(self)',
          'usb=()',
          'magnetometer=()',
          'gyroscope=()',
          'accelerometer=()',
        ].join(', '),
      },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
    ];

    return [
      { source: '/:path*', headers: securityHeaders },
      {
        source: '/static/:path*',
        headers: [...securityHeaders, { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/_next/image/:path*',
        headers: [
          ...securityHeaders,
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: "default-src 'none'; frame-ancestors 'none'" },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
        ],
      },
    ];
  },
};

const withI18n = withNextIntl(nextConfig);

const withPostHog = (config: NextConfig) =>
  process.env.POSTHOG_PERSONAL_API_KEY
    ? withPostHogConfig(config, {
        personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY,
        envId: process.env.POSTHOG_ENV_ID ?? 'default',
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
        sourcemaps: {
          enabled: true,
          project: 'nuclom',
          version: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.BUILD_ID ?? 'development',
        },
      })
    : config;

export default withWorkflow(withMicrofrontends(withPostHog(withI18n)));
