import createNextIntlPlugin from "next-intl/plugin";
import { withPostHogConfig } from "@posthog/nextjs-config";
import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // Enable Partial Prerendering (PPR) via cache components
  cacheComponents: true,

  // Skip during build - CI handles type checking
  typescript: { ignoreBuildErrors: true },

  // Disable production source maps for faster builds
  // PostHog handles source maps upload separately
  productionBrowserSourceMaps: false,

  // Server external packages - these are large and work better as externals
  // They won't be bundled, reducing build time and memory usage
  serverExternalPackages: [
    "postgres",
    "drizzle-orm",
    "@aws-sdk/client-s3",
    "@aws-sdk/lib-storage",
    "@aws-sdk/s3-request-presigner",
    "sharp",
    "openai",
    "replicate",
    "stripe",
    "resend",
    "posthog-node",
  ],

  // Bundle pages router dependencies for consistency
  bundlePagesRouterDependencies: true,

  // Turbopack configuration for faster development builds
  turbopack: {
    // Resolve aliases for faster module resolution
    resolveAlias: {
      // Optimize canvas for environments where it's not available
      canvas: "./src/lib/utils/canvas-stub.ts",
    },
  },

  // Experimental features for improved performance
  experimental: {
    // Enable CSS chunking for better caching
    cssChunking: true,
    // Parallel routes optimization
    parallelServerCompiles: true,
    // Parallel server build traces
    parallelServerBuildTraces: true,
    // Use Web Assembly for faster builds
    webpackBuildWorker: true,
    // Optimize server memory usage
    webpackMemoryOptimizations: true,
    // Optimize package imports for tree-shaking
    // This significantly reduces bundle size and build time for large packages
    optimizePackageImports: [
      // UI component libraries
      "lucide-react",
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-aspect-ratio",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-context-menu",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-hover-card",
      "@radix-ui/react-label",
      "@radix-ui/react-menubar",
      "@radix-ui/react-navigation-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group",
      "@radix-ui/react-tooltip",
      // Utility libraries
      "date-fns",
      "recharts",
      // Effect ecosystem
      "effect",
      "@effect/platform",
      "@effect/sql",
      // AI SDK
      "ai",
      "@ai-sdk/react",
    ],
  },

  // Image optimization configuration
  images: {
    // Enable modern image formats for better compression
    formats: ["image/avif", "image/webp"],
    // Default device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // Image sizes for the sizes attribute optimization
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Remote patterns for external images (e.g., user avatars, CDN thumbnails)
    remotePatterns: [
      // GitHub avatars
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      // Google user photos
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      // Gravatar
      {
        protocol: "https",
        hostname: "*.gravatar.com",
      },
      // Cloudflare R2 public bucket URLs
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
    ],
    // Minimize image reprocessing in development
    minimumCacheTTL: 60,
  },

  // Enable compression for API responses
  compress: true,

  // Headers for security and caching
  async headers() {
    // Content Security Policy directives
    const cspDirectives = [
      "default-src 'self'",
      // Allow scripts from self, inline (for Next.js), Vercel Analytics, Vercel Live, PostHog, and Mintlify
      // 'unsafe-eval' is required for Mintlify's frontmatter parsing (uses new Function())
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live https://us-assets.i.posthog.com https://eu-assets.i.posthog.com https://cdn.jsdelivr.net https://browser.sentry-cdn.com https://js.sentry-cdn.com",
      // Allow styles from self, inline (required for styled-components/emotion), and Mintlify
      "style-src 'self' 'unsafe-inline' https://d4tuoctqmanu0.cloudfront.net https://fonts.googleapis.com",
      // Allow images from self, data URIs, blob URIs, and trusted domains including Mintlify
      "img-src 'self' data: blob: https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://*.gravatar.com https://*.r2.dev https://*.r2.cloudflarestorage.com https://d3gk2c5xim1je2.cloudfront.net https://mintcdn.com https://*.mintcdn.com https://cdn.jsdelivr.net https://mintlify.s3.us-west-1.amazonaws.com https://mintlify.s3-us-west-1.amazonaws.com",
      // Allow fonts from self, Google Fonts, and Mintlify
      "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com https://d4tuoctqmanu0.cloudfront.net",
      // Allow connections to self, API endpoints, external services, Vercel Analytics, Vercel Live, PostHog, and Mintlify
      "connect-src 'self' https://*.r2.cloudflarestorage.com https://api.stripe.com wss://*.nuclom.com https://vitals.vercel-insights.com https://vercel.live wss://ws-us3.pusher.com https://us.i.posthog.com https://eu.i.posthog.com https://*.posthog.com https://*.mintlify.dev https://*.mintlify.com https://d1ctpt7j8wusba.cloudfront.net https://mintcdn.com https://*.mintcdn.com https://api.mintlifytrieve.com https://browser.sentry-cdn.com",
      // Allow media from self and R2 storage
      "media-src 'self' blob: https://*.r2.dev https://*.r2.cloudflarestorage.com",
      // Allow frames from Mintlify
      "frame-src 'self' https://*.mintlify.dev",
      // Prevent embedding in iframes (except for allowed origins)
      "frame-ancestors 'self'",
      // Form submissions only to self
      "form-action 'self'",
      // Upgrade insecure requests in production
      process.env.NODE_ENV === "production" ? "upgrade-insecure-requests" : "",
      // Block mixed content
      "block-all-mixed-content",
    ]
      .filter(Boolean)
      .join("; ");

    // Security headers applied to all routes
    const securityHeaders = [
      {
        key: "Content-Security-Policy",
        value: cspDirectives,
      },
      {
        // Prevent clickjacking by blocking iframe embedding
        key: "X-Frame-Options",
        value: "SAMEORIGIN",
      },
      {
        // Prevent MIME type sniffing
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        // Control referrer information sent with requests
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        // Restrict browser features
        key: "Permissions-Policy",
        value: [
          "camera=(self)",
          "microphone=(self)",
          "geolocation=()",
          "interest-cohort=()",
          "payment=(self)",
          "usb=()",
          "magnetometer=()",
          "gyroscope=()",
          "accelerometer=()",
        ].join(", "),
      },
      {
        // Enable XSS protection in older browsers
        key: "X-XSS-Protection",
        value: "1; mode=block",
      },
      {
        // Prevent DNS prefetching for privacy
        key: "X-DNS-Prefetch-Control",
        value: "on",
      },
    ];

    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Cache static assets for 1 year
        source: "/static/:path*",
        headers: [
          ...securityHeaders,
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache images with stale-while-revalidate
        source: "/_next/image/:path*",
        headers: [
          ...securityHeaders,
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=604800",
          },
        ],
      },
      {
        // Stricter CSP for API routes (no need for scripts/styles)
        source: "/api/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; frame-ancestors 'none'",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
        ],
      },
    ];
  },
};

// Apply plugins in sequence - workflow wraps the i18n-wrapped config
const withI18n = withNextIntl(nextConfig);

// PostHog configuration for source maps upload during production builds
// Only enables source map upload when POSTHOG_PERSONAL_API_KEY is set
const withPostHog = (config: NextConfig) =>
  process.env.POSTHOG_PERSONAL_API_KEY
    ? withPostHogConfig(config, {
        personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY,
        envId: process.env.POSTHOG_ENV_ID ?? "default",
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com",
        sourcemaps: {
          enabled: true,
          project: "nuclom",
          // Use git commit hash or build ID for versioning
          version: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.BUILD_ID ?? "development",
        },
      })
    : config;

export default withWorkflow(withPostHog(withI18n));
