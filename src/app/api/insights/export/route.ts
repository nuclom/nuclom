import { and, desc, eq, gte } from 'drizzle-orm';
import { Cause, Effect, Exit } from 'effect';
import { connection, type NextRequest, NextResponse } from 'next/server';
import { createPublicLayer } from '@/lib/api-handler';
import { aiActionItems, decisions, videoSpeakers, videos } from '@/lib/db/schema';
import { DatabaseError, UnauthorizedError, ValidationError } from '@/lib/effect/errors';
import { Database } from '@/lib/effect/services/database';

function validateQueryParams(searchParams: URLSearchParams) {
  const organizationId = searchParams.get('organizationId');
  const period = searchParams.get('period') || '30d';
  const type = searchParams.get('type') || 'all';
  const format = searchParams.get('format') || 'csv';

  if (!organizationId) {
    return Effect.fail(new UnauthorizedError({ message: 'Organization ID is required' }));
  }

  if (!['csv', 'json'].includes(format)) {
    return Effect.fail(new ValidationError({ message: 'Format must be csv or json' }));
  }

  if (!['all', 'videos', 'decisions', 'action-items', 'speakers'].includes(type)) {
    return Effect.fail(new ValidationError({ message: 'Invalid export type' }));
  }

  return Effect.succeed({ organizationId, period, type, format });
}

function getDateRangeForPeriod(period: string): Date {
  const now = new Date();
  switch (period) {
    case '7d':
      return new Date(now.setDate(now.getDate() - 7));
    case '30d':
      return new Date(now.setDate(now.getDate() - 30));
    case '90d':
      return new Date(now.setDate(now.getDate() - 90));
    default:
      return new Date(0);
  }
}

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCSV).join(',');
  const dataLines = rows.map((row) => row.map(escapeCSV).join(','));
  return [headerLine, ...dataLines].join('\n');
}

export async function GET(request: NextRequest) {
  await connection();

  const program = Effect.gen(function* () {
    const { organizationId, period, type, format } = yield* validateQueryParams(request.nextUrl.searchParams);
    const startDate = getDateRangeForPeriod(period);
    const { db } = yield* Database;

    const exportData: Record<string, unknown> = {};

    // Export videos
    if (type === 'all' || type === 'videos') {
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
        catch: (error) => new DatabaseError({ message: `Failed to fetch videos: ${error}`, operation: 'exportVideos' }),
      });

      exportData.videos = videoData.map((v) => ({
        id: v.id,
        title: v.title,
        description: v.description || '',
        durationSeconds: v.duration,
        durationMinutes: Math.round(Number(v.duration) / 60),
        createdAt: v.createdAt?.toISOString(),
        hasSummary: !!v.aiSummary,
      }));
    }

    // Export decisions
    if (type === 'all' || type === 'decisions') {
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
        catch: (error) =>
          new DatabaseError({ message: `Failed to fetch decisions: ${error}`, operation: 'exportDecisions' }),
      });

      exportData.decisions = decisionData.map((d) => ({
        id: d.id,
        summary: d.summary,
        context: d.context || '',
        status: d.status,
        decisionType: d.decisionType,
        videoId: d.videoId || '',
        createdAt: d.createdAt?.toISOString(),
      }));
    }

    // Export action items
    if (type === 'all' || type === 'action-items') {
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
        catch: (error) =>
          new DatabaseError({ message: `Failed to fetch action items: ${error}`, operation: 'exportActionItems' }),
      });

      exportData.actionItems = actionItemData.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description || '',
        assignee: a.assignee || '',
        status: a.status,
        priority: a.priority,
        dueDate: a.dueDate?.toISOString() || '',
        completedAt: a.completedAt?.toISOString() || '',
        videoId: a.videoId,
        confidence: a.confidence,
        createdAt: a.createdAt?.toISOString(),
      }));
    }

    // Export speakers
    if (type === 'all' || type === 'speakers') {
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
        catch: (error) =>
          new DatabaseError({ message: `Failed to fetch speakers: ${error}`, operation: 'exportSpeakers' }),
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

  // Run with proper layer and exit handling
  const runnable = Effect.provide(program, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  // Handle exit with custom response format for exports
  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === 'Some') {
        const err = error.value;
        if ('_tag' in err && err._tag === 'UnauthorizedError') {
          return NextResponse.json({ success: false, error: err.message }, { status: 401 });
        }
        if ('_tag' in err && err._tag === 'ValidationError') {
          return NextResponse.json({ success: false, error: err.message }, { status: 400 });
        }
        const message = 'message' in err ? err.message : 'Database error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
      }
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    },
    onSuccess: (result) => {
      const { exportData, format, type, period } = result;
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `insights-export-${type}-${period}-${timestamp}`;

      if (format === 'json') {
        return new NextResponse(JSON.stringify(exportData, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${filename}.json"`,
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
        csvSections.push('# Videos');
        csvSections.push(
          toCSV(
            ['ID', 'Title', 'Description', 'Duration (min)', 'Created At', 'Has Summary'],
            videosTyped.map((v) => [
              v.id,
              v.title,
              v.description,
              v.durationMinutes,
              v.createdAt,
              v.hasSummary ? 'Yes' : 'No',
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
        csvSections.push('\n# Decisions');
        csvSections.push(
          toCSV(
            ['ID', 'Summary', 'Context', 'Status', 'Type', 'Video ID', 'Created At'],
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
        csvSections.push('\n# Action Items');
        csvSections.push(
          toCSV(
            [
              'ID',
              'Title',
              'Description',
              'Assignee',
              'Status',
              'Priority',
              'Due Date',
              'Completed At',
              'Video ID',
              'Confidence',
              'Created At',
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
        csvSections.push('\n# Speakers');
        csvSections.push(
          toCSV(
            ['Video ID', 'Speaker Label', 'Speaking Time (sec)', 'Speaking %', 'Segment Count'],
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

      const csvContent = csvSections.join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}.csv"`,
        },
      });
    },
  });
}
