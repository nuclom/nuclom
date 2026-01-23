import { withMicrofrontends } from '@vercel/microfrontends/next/config';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable compression for API responses
  compress: true,

  // Skip during build - CI handles type checking and linting
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  // Optimize barrel file imports for better bundle size and faster builds
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },

  // Image optimization configuration
  images: {
    formats: ['image/avif', 'image/webp'],
  },
};

export default withMicrofrontends(nextConfig);
