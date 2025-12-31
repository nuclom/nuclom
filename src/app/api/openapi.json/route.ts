import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/openapi";

/**
 * GET /api/openapi.json
 * Returns the OpenAPI specification in JSON format
 */
export async function GET() {
  return NextResponse.json(openApiSpec, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
