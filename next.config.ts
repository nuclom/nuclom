import { withWorkflow } from "workflow/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skip during build - CI handles type checking
  typescript: { ignoreBuildErrors: true },
};

export default withWorkflow(nextConfig);
