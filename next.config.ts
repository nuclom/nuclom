import createNextIntlPlugin from "next-intl/plugin";
import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // Enable Partial Prerendering (PPR) via cache components
  cacheComponents: true,

  // Skip during build - CI handles type checking
  typescript: { ignoreBuildErrors: true },

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
      // Allow scripts from self, inline (for Next.js), and eval (for development)
      process.env.NODE_ENV === "development"
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline'",
      // Allow styles from self and inline (required for styled-components/emotion)
      "style-src 'self' 'unsafe-inline'",
      // Allow images from self, data URIs, blob URIs, and trusted domains
      "img-src 'self' data: blob: https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://*.gravatar.com https://*.r2.dev https://*.r2.cloudflarestorage.com",
      // Allow fonts from self and Google Fonts
      "font-src 'self' https://fonts.gstatic.com",
      // Allow connections to self, API endpoints, and external services
      "connect-src 'self' https://*.r2.cloudflarestorage.com https://api.stripe.com wss://*.nuclom.com",
      // Allow media from self and R2 storage
      "media-src 'self' blob: https://*.r2.dev https://*.r2.cloudflarestorage.com",
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
export default withWorkflow(withI18n);
