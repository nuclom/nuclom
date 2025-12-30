import { type NextRequest, NextResponse } from "next/server";
import { aiService } from "@/lib/ai";
import { CachePresets, getCacheControlHeader } from "@/lib/api-utils";
import type { ApiResponse } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const { transcript, type } = await request.json();

    if (!transcript) {
      return NextResponse.json({ success: false, error: "Transcript is required" }, { status: 400 });
    }

    let result: string | string[];

    switch (type) {
      case "summary":
        result = await aiService.generateVideoSummary(transcript);
        break;
      case "action-items":
        result = await aiService.extractActionItems(transcript);
        break;
      default:
        return NextResponse.json({ success: false, error: "Invalid analysis type" }, { status: 400 });
    }

    const response: ApiResponse = {
      success: true,
      data: { result, type },
    };

    // AI analysis results don't change - use long cache with stale-while-revalidate
    return NextResponse.json(response, {
      headers: {
        "Cache-Control": getCacheControlHeader(CachePresets.aiAnalysis()),
      },
    });
  } catch (error) {
    console.error("Error in AI analysis:", error);
    return NextResponse.json({ success: false, error: "Failed to analyze content" }, { status: 500 });
  }
}
