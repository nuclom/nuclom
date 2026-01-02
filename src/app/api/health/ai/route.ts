import { gateway } from "@ai-sdk/gateway";
import { generateText } from "ai";
import { connection } from "next/server";
import { logger } from "@/lib/logger";

export interface AIHealthStatus {
  status: "healthy" | "unhealthy" | "not_configured";
  latencyMs: number;
  timestamp: string;
  details?: {
    model?: string;
    provider?: string;
  };
  error?: string;
}

export async function GET() {
  await connection();

  const startTime = performance.now();

  try {
    // Use Vercel AI Gateway for health check
    const model = gateway("xai/grok-3");

    // Simple generation to verify the service is working
    const result = await generateText({
      model,
      prompt: "Reply with 'ok'",
    });

    const latencyMs = Math.round(performance.now() - startTime);

    // Verify we got a response
    if (!result.text) {
      throw new Error("Empty response from AI service");
    }

    const response: AIHealthStatus = {
      status: "healthy",
      latencyMs,
      timestamp: new Date().toISOString(),
      details: {
        model: "xai/grok-3",
        provider: "vercel-ai-gateway",
      },
    };

    logger.debug("AI health check passed", { latencyMs });

    return Response.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startTime);
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for common configuration issues
    const isConfigError =
      errorMessage.includes("API key") || errorMessage.includes("authentication") || errorMessage.includes("401");

    logger.error("AI health check failed", error instanceof Error ? error : new Error(errorMessage));

    const response: AIHealthStatus = {
      status: isConfigError ? "not_configured" : "unhealthy",
      latencyMs,
      timestamp: new Date().toISOString(),
      details: {
        model: "xai/grok-3",
        provider: "vercel-ai-gateway",
      },
      error: errorMessage,
    };

    return Response.json(response, {
      status: isConfigError ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }
}
