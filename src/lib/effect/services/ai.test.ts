import { Effect, Exit } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI, AILive } from "./ai";

// Mock the ai package
vi.mock("ai", () => ({
  generateText: vi.fn(),
  streamText: vi.fn(),
}));

// Mock the gateway
vi.mock("@ai-sdk/gateway", () => ({
  gateway: vi.fn().mockReturnValue("mock-model"),
}));

import { generateText } from "ai";

// Helper to create a mock AI response
function createMockAIResponse(text: string) {
  return {
    text,
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    finishReason: "stop",
    response: {
      id: "resp-123",
      timestamp: new Date(),
      modelId: "xai/grok-3",
      headers: {},
    },
    warnings: [],
    providerMetadata: undefined,
    request: { body: "" },
    toJsonResponse: vi.fn(),
    experimental_output: undefined,
    steps: [],
    toolCalls: [],
    toolResults: [],
    logprobs: undefined,
    reasoning: undefined,
    reasoningDetails: [],
    files: [],
    sources: [],
    // Additional properties required by GenerateTextResult type
    content: [],
    reasoningText: undefined,
    staticToolCalls: [],
    dynamicToolCalls: [],
    rawResponse: undefined,
    experimental_providerMetadata: undefined,
  } as never;
}

describe("AI Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("generateVideoSummary", () => {
    it("should generate a summary from transcript", async () => {
      const mockSummary = `## Summary
This is a test summary.

## Key Points
- Point 1
- Point 2

## Action Items
- Action 1`;

      vi.mocked(generateText).mockResolvedValueOnce(createMockAIResponse(mockSummary));

      const program = Effect.gen(function* () {
        const ai = yield* AI;
        return yield* ai.generateVideoSummary("Test transcript content");
      });

      const result = await Effect.runPromise(Effect.provide(program, AILive));

      expect(result).toContain("## Summary");
      expect(result).toContain("Key Points");
      expect(generateText).toHaveBeenCalledOnce();
    });

    it("should handle AI service errors", async () => {
      vi.mocked(generateText).mockRejectedValueOnce(new Error("API rate limit exceeded"));

      const program = Effect.gen(function* () {
        const ai = yield* AI;
        return yield* ai.generateVideoSummary("Test transcript");
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, AILive));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe("generateVideoTags", () => {
    it("should generate tags from title and description", async () => {
      vi.mocked(generateText).mockResolvedValueOnce(
        createMockAIResponse("react, typescript, tutorial, web development, programming"),
      );

      const program = Effect.gen(function* () {
        const ai = yield* AI;
        return yield* ai.generateVideoTags("React Tutorial", "Learn React basics");
      });

      const result = await Effect.runPromise(Effect.provide(program, AILive));

      expect(result).toContain("react");
      expect(result).toContain("typescript");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should return empty array on error (fallback behavior)", async () => {
      vi.mocked(generateText).mockRejectedValueOnce(new Error("API error"));

      const program = Effect.gen(function* () {
        const ai = yield* AI;
        return yield* ai.generateVideoTags("Test Video");
      });

      const result = await Effect.runPromise(Effect.provide(program, AILive));

      expect(result).toEqual([]);
    });
  });

  describe("extractActionItems", () => {
    it("should extract action items from transcript", async () => {
      vi.mocked(generateText).mockResolvedValueOnce(
        createMockAIResponse("- Complete the setup\n- Review the documentation\n- Submit the PR"),
      );

      const program = Effect.gen(function* () {
        const ai = yield* AI;
        return yield* ai.extractActionItems("We need to complete the setup and review docs");
      });

      const result = await Effect.runPromise(Effect.provide(program, AILive));

      expect(result).toHaveLength(3);
      expect(result[0]).toBe("Complete the setup");
    });

    it("should return empty array when no action items found", async () => {
      vi.mocked(generateText).mockResolvedValueOnce(createMockAIResponse("None"));

      const program = Effect.gen(function* () {
        const ai = yield* AI;
        return yield* ai.extractActionItems("Just a casual conversation with no tasks");
      });

      const result = await Effect.runPromise(Effect.provide(program, AILive));

      expect(result).toEqual([]);
    });
  });

  describe("extractActionItemsWithTimestamps", () => {
    it("should extract action items with timestamps from segments", async () => {
      const mockResponse = JSON.stringify([
        { text: "Complete setup", timestamp: 120, priority: "high" },
        { text: "Review docs", timestamp: 300, priority: "medium" },
      ]);

      vi.mocked(generateText).mockResolvedValueOnce(createMockAIResponse(mockResponse));

      const segments = [
        { text: "We need to complete setup", startTime: 100, endTime: 130 },
        { text: "And review the docs", startTime: 280, endTime: 320 },
      ];

      const program = Effect.gen(function* () {
        const ai = yield* AI;
        return yield* ai.extractActionItemsWithTimestamps(segments);
      });

      const result = await Effect.runPromise(Effect.provide(program, AILive));

      expect(result).toHaveLength(2);
      expect(result[0].timestamp).toBe(120);
      expect(result[0].priority).toBe("high");
    });
  });

  describe("detectCodeSnippets", () => {
    it("should detect code snippets from transcript", async () => {
      const mockResponse = JSON.stringify([
        {
          language: "javascript",
          code: "console.log('hello')",
          title: "Console log example",
          description: "Basic logging",
          timestamp: 60,
        },
      ]);

      vi.mocked(generateText).mockResolvedValueOnce(createMockAIResponse(mockResponse));

      const program = Effect.gen(function* () {
        const ai = yield* AI;
        return yield* ai.detectCodeSnippets("Let me show you console dot log hello");
      });

      const result = await Effect.runPromise(Effect.provide(program, AILive));

      expect(result).toHaveLength(1);
      expect(result[0].language).toBe("javascript");
      expect(result[0].code).toContain("console.log");
    });

    it("should return empty array when no code snippets found", async () => {
      vi.mocked(generateText).mockResolvedValueOnce(createMockAIResponse("[]"));

      const program = Effect.gen(function* () {
        const ai = yield* AI;
        return yield* ai.detectCodeSnippets("Just a regular conversation");
      });

      const result = await Effect.runPromise(Effect.provide(program, AILive));

      expect(result).toEqual([]);
    });
  });

  describe("generateChapters", () => {
    it("should generate chapters from transcript segments", async () => {
      const mockResponse = JSON.stringify([
        { title: "Introduction", summary: "Overview", startTime: 0, endTime: 120 },
        { title: "Main Content", summary: "Core explanation", startTime: 120, endTime: 360 },
      ]);

      vi.mocked(generateText).mockResolvedValueOnce(createMockAIResponse(mockResponse));

      const segments = [
        { text: "Welcome to this tutorial", startTime: 0, endTime: 30 },
        { text: "Let's dive into the main topic", startTime: 120, endTime: 150 },
        { text: "And that concludes our lesson", startTime: 350, endTime: 360 },
      ];

      const program = Effect.gen(function* () {
        const ai = yield* AI;
        return yield* ai.generateChapters(segments, "Tutorial Video");
      });

      const result = await Effect.runPromise(Effect.provide(program, AILive));

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe("Introduction");
      expect(result[0].startTime).toBe(0);
    });

    it("should return empty array for empty segments", async () => {
      const program = Effect.gen(function* () {
        const ai = yield* AI;
        return yield* ai.generateChapters([]);
      });

      const result = await Effect.runPromise(Effect.provide(program, AILive));

      expect(result).toEqual([]);
      expect(generateText).not.toHaveBeenCalled();
    });
  });
});
