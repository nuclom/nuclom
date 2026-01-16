import { withMicrofrontends } from "@vercel/microfrontends/next/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable compression for API responses
  compress: true,

  // Image optimization configuration
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default withMicrofrontends(nextConfig);
