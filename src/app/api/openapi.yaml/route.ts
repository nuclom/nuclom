import { NextResponse } from "next/server";
import { openApiSpec, specToYaml } from "@/lib/openapi";

/**
 * GET /api/openapi.yaml
 * Returns the OpenAPI specification in YAML format
 */
export async function GET() {
  const yamlContent = specToYaml(openApiSpec);

  return new NextResponse(yamlContent, {
    headers: {
      "Content-Type": "text/yaml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
