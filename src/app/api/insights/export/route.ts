import { Effect } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { connection } from "next/server";
import { and, eq, gte, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { videos, decisions, aiActionItems, videoSpeakers } from "@/lib/db/schema";

class DatabaseError {
  readonly _tag = "DatabaseError";
  constructor(readonly message: string) {}
}

class UnauthorizedError {
  readonly _tag = "UnauthorizedError";
  constructor(readonly message: string) {}
}

class ValidationError {
  readonly _tag = "ValidationError";
  constructor(readonly message: string) {}
}

function validateQueryParams(searchParams: URLSearchParams) {
  const organizationId = searchParams.get("organizationId");
  const period = searchParams.get("period") || "30d";
  const type = searchParams.get("type") || "all";
  const format = searchParams.get("format") || "csv";

  if (!organizationId) {
    return Effect.fail(new UnauthorizedError("Organization ID is required"));
  }

  if (!["csv", "json"].includes(format)) {
    return Effect.fail(new ValidationError("Format must be csv or json"));
  }

  if (!["all", "videos", "decisions", "action-items", "speakers"].includes(type)) {
    return Effect.fail(new ValidationError("Invalid export type"));
  }

  return Effect.succeed({ organizationId, period, type, format });
}

function getDateRangeForPeriod(period: string): Date {
  const now = new Date();
  switch (period) {
    case "7d":
      return new Date(now.setDate(now.getDate() - 7));
    case "30d":
      return new Date(now.setDate(now.getDate() - 30));
    case "90d":
      return new Date(now.setDate(now.getDate() - 90));
    default:
      return new Date(0);
  }
}

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCSV).join(",");
  const dataLines = rows.map((row) => row.map(escapeCSV).join(","));
  return [headerLine, ...dataLines].join("\n");
}

export async function GET(request: NextRequest) {
  await connection();

  const program = Effect.gen(function* () {
    const { organizationId, period, type, format } = yield* validateQueryParams(request.nextUrl.searchParams);
    const startDate = getDateRangeForPeriod(period);

    const exportData: Record<string, unknown> = {};

    // Export videos
    if (type === "all" || type === "videos") {
      const videoData = yield* Effect.tryPromise({
        try: async () => {
          const result = await db
            .select({
              id: videos.id,
              title: videos.title,
              description: videos.description,
              duration: videos.duration,
              createdAt: videos.createdAt,
              aiSummary: videos.aiSummary,
            })
            .from(videos)
            .where(and(eq(videos.organizationId, organizationId), gte(videos.createdAt, startDate)))
            .orderBy(desc(videos.createdAt));
          return result;
        },
        catch: (error) => new DatabaseError(`Failed to fetch videos: ${error}`),
      });

      exportData.videos = videoData.map((v) => ({
        id: v.id,
        title: v.title,
        description: v.description || "",
        durationSeconds: v.duration,
        durationMinutes: Math.round(Number(v.duration) / 60),
        createdAt: v.createdAt?.toISOString(),
        hasSummary: !!v.aiSummary,
      }));
    }

    // Export decisions
    if (type === "all" || type === "decisions") {
      const decisionData = yield* Effect.tryPromise({
        try: async () => {
          const result = await db
            .select({
              id: decisions.id,
              summary: decisions.summary,
              context: decisions.context,
              status: decisions.status,
              decisionType: decisions.decisionType,
              videoId: decisions.videoId,
              createdAt: decisions.createdAt,
            })
            .from(decisions)
            .where(and(eq(decisions.organizationId, organizationId), gte(decisions.createdAt, startDate)))
            .orderBy(desc(decisions.createdAt));
          return result;
        },
        catch: (error) => new DatabaseError(`Failed to fetch decisions: ${error}`),
      });

      exportData.decisions = decisionData.map((d) => ({
        id: d.id,
        summary: d.summary,
        context: d.context || "",
        status: d.status,
        decisionType: d.decisionType,
        videoId: d.videoId || "",
        createdAt: d.createdAt?.toISOString(),
      }));
    }

    // Export action items
    if (type === "all" || type === "action-items") {
      const actionItemData = yield* Effect.tryPromise({
        try: async () => {
          const result = await db
            .select({
              id: aiActionItems.id,
              title: aiActionItems.title,
              description: aiActionItems.description,
              assignee: aiActionItems.assignee,
              status: aiActionItems.status,
              priority: aiActionItems.priority,
              dueDate: aiActionItems.dueDate,
              completedAt: aiActionItems.completedAt,
              videoId: aiActionItems.videoId,
              confidence: aiActionItems.confidence,
              createdAt: aiActionItems.createdAt,
            })
            .from(aiActionItems)
            .where(and(eq(aiActionItems.organizationId, organizationId), gte(aiActionItems.createdAt, startDate)))
            .orderBy(desc(aiActionItems.createdAt));
          return result;
        },
        catch: (error) => new DatabaseError(`Failed to fetch action items: ${error}`),
      });

      exportData.actionItems = actionItemData.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description || "",
        assignee: a.assignee || "",
        status: a.status,
        priority: a.priority,
        dueDate: a.dueDate?.toISOString() || "",
        completedAt: a.completedAt?.toISOString() || "",
        videoId: a.videoId,
        confidence: a.confidence,
        createdAt: a.createdAt?.toISOString(),
      }));
    }

    // Export speakers
    if (type === "all" || type === "speakers") {
      const speakerData = yield* Effect.tryPromise({
        try: async () => {
          const result = await db
            .select({
              videoId: videoSpeakers.videoId,
              speakerLabel: videoSpeakers.speakerLabel,
              totalSpeakingTime: videoSpeakers.totalSpeakingTime,
              speakingPercentage: videoSpeakers.speakingPercentage,
              segmentCount: videoSpeakers.segmentCount,
            })
            .from(videoSpeakers)
            .innerJoin(videos, eq(videoSpeakers.videoId, videos.id))
            .where(and(eq(videos.organizationId, organizationId), gte(videos.createdAt, startDate)));
          return result;
        },
        catch: (error) => new DatabaseError(`Failed to fetch speakers: ${error}`),
      });

      exportData.speakers = speakerData.map((s) => ({
        videoId: s.videoId,
        speakerLabel: s.speakerLabel,
        totalSpeakingTimeSeconds: s.totalSpeakingTime,
        speakingPercentage: s.speakingPercentage,
        segmentCount: s.segmentCount,
      }));
    }

    return { exportData, format, type, period };
  });

  const result = await Effect.runPromise(
    program.pipe(
      Effect.catchAll((error) => {
        if (error._tag === "UnauthorizedError") {
          return Effect.succeed({ error: error.message, status: 401 });
        }
        if (error._tag === "ValidationError") {
          return Effect.succeed({ error: error.message, status: 400 });
        }
        return Effect.succeed({ error: error.message, status: 500 });
      }),
    ),
  );

  if ("error" in result) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  const { exportData, format, type, period } = result;
  const timestamp = new Date().toISOString().split("T")[0];
  const filename = `insights-export-${type}-${period}-${timestamp}`;

  if (format === "json") {
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}.json"`,
      },
    });
  }

  // CSV format - create separate sections or a single merged file
  const csvSections: string[] = [];

  if (exportData.videos && Array.isArray(exportData.videos) && exportData.videos.length > 0) {
    const videosTyped = exportData.videos as Array<{
      id: string;
      title: string;
      description: string;
      durationSeconds: string;
      durationMinutes: number;
      createdAt: string;
      hasSummary: boolean;
    }>;
    csvSections.push("# Videos");
    csvSections.push(
      toCSV(
        ["ID", "Title", "Description", "Duration (min)", "Created At", "Has Summary"],
        videosTyped.map((v) => [
          v.id,
          v.title,
          v.description,
          v.durationMinutes,
          v.createdAt,
          v.hasSummary ? "Yes" : "No",
        ]),
      ),
    );
  }

  if (exportData.decisions && Array.isArray(exportData.decisions) && exportData.decisions.length > 0) {
    const decisionsTyped = exportData.decisions as Array<{
      id: string;
      summary: string;
      context: string;
      status: string;
      decisionType: string;
      videoId: string;
      createdAt: string;
    }>;
    csvSections.push("\n# Decisions");
    csvSections.push(
      toCSV(
        ["ID", "Summary", "Context", "Status", "Type", "Video ID", "Created At"],
        decisionsTyped.map((d) => [d.id, d.summary, d.context, d.status, d.decisionType, d.videoId, d.createdAt]),
      ),
    );
  }

  if (exportData.actionItems && Array.isArray(exportData.actionItems) && exportData.actionItems.length > 0) {
    const actionItemsTyped = exportData.actionItems as Array<{
      id: string;
      title: string;
      description: string;
      assignee: string;
      status: string;
      priority: string;
      dueDate: string;
      completedAt: string;
      videoId: string;
      confidence: number | null;
      createdAt: string;
    }>;
    csvSections.push("\n# Action Items");
    csvSections.push(
      toCSV(
        [
          "ID",
          "Title",
          "Description",
          "Assignee",
          "Status",
          "Priority",
          "Due Date",
          "Completed At",
          "Video ID",
          "Confidence",
          "Created At",
        ],
        actionItemsTyped.map((a) => [
          a.id,
          a.title,
          a.description,
          a.assignee,
          a.status,
          a.priority,
          a.dueDate,
          a.completedAt,
          a.videoId,
          a.confidence,
          a.createdAt,
        ]),
      ),
    );
  }

  if (exportData.speakers && Array.isArray(exportData.speakers) && exportData.speakers.length > 0) {
    const speakersTyped = exportData.speakers as Array<{
      videoId: string;
      speakerLabel: string;
      totalSpeakingTimeSeconds: number;
      speakingPercentage: number | null;
      segmentCount: number;
    }>;
    csvSections.push("\n# Speakers");
    csvSections.push(
      toCSV(
        ["Video ID", "Speaker Label", "Speaking Time (sec)", "Speaking %", "Segment Count"],
        speakersTyped.map((s) => [
          s.videoId,
          s.speakerLabel,
          s.totalSpeakingTimeSeconds,
          s.speakingPercentage,
          s.segmentCount,
        ]),
      ),
    );
  }

  const csvContent = csvSections.join("\n");

  return new NextResponse(csvContent, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
