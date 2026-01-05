import { Schema } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { aiService } from "@/lib/ai";
import { CachePresets, getCacheControlHeader } from "@/lib/api-utils";
import { logger } from "@/lib/logger";
import type { ApiResponse } from "@/lib/types";
import { safeParse } from "@/lib/validation";

const AnalyzeRequestSchema = Schema.Struct({
  transcript: Schema.String.pipe(Schema.minLength(1)),
  type: Schema.Literal("summary", "action-items"),
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const result = safeParse(AnalyzeRequestSchema, rawBody);
    if (!result.success) {
      return NextResponse.json({ success: false, error: "Transcript and valid type are required" }, { status: 400 });
    }
    const { transcript, type } = result.data;

    let analysisResult: string | string[];

    switch (type) {
      case "summary":
        analysisResult = await aiService.generateVideoSummary(transcript);
        break;
      case "action-items":
        analysisResult = await aiService.extractActionItems(transcript);
        break;
    }

    const response: ApiResponse = {
      success: true,
      data: { result: analysisResult, type },
    };

    // AI analysis results don't change - use long cache with stale-while-revalidate
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": getCacheControlHeader(CachePresets.aiAnalysis()),
      },
    });
  } catch (error) {
    logger.error("Error in AI analysis", error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json({ success: false, error: "Failed to analyze content" }, { status: 500 });
  }
}
