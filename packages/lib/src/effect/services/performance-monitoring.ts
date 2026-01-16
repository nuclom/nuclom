/**
 * Performance Monitoring Service using Effect-TS
 *
 * Tracks application performance metrics for:
 * - Video load times
 * - API response times
 * - Upload speeds
 * - Error rates
 * - User engagement metrics
 */

import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import { type PerformanceMetric, performanceMetrics } from '@/lib/db/schema';
import { DatabaseError } from '../errors';
import { Database } from './database';

// =============================================================================
// Types
// =============================================================================

export type MetricType =
  | 'video_load'
  | 'video_buffer'
  | 'video_error'
  | 'api_response'
  | 'upload_speed'
  | 'upload_complete'
  | 'upload_error'
  | 'ai_processing'
  | 'search_latency'
  | 'page_load'
  | 'interaction'
  | 'error';

export interface RecordMetricInput {
  readonly organizationId: string;
  readonly metricType: MetricType;
  readonly metricName: string;
  readonly value: number; // milliseconds or bytes depending on type
  readonly userId?: string;
  readonly videoId?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface MetricsSummary {
  readonly metricType: string;
  readonly metricName: string;
  readonly count: number;
  readonly avgValue: number;
  readonly minValue: number;
  readonly maxValue: number;
  readonly p50Value: number;
  readonly p95Value: number;
  readonly p99Value: number;
}

export interface MetricsTimeSeries {
  readonly timestamp: Date;
  readonly value: number;
  readonly count: number;
}

export interface PerformanceReport {
  readonly period: { start: Date; end: Date };
  readonly summary: MetricsSummary[];
  readonly errorRate: number;
  readonly avgVideoLoadTime: number;
  readonly avgApiResponseTime: number;
  readonly totalMetrics: number;
}

export interface PerformanceMonitoringServiceInterface {
  /**
   * Record a performance metric
   */
  readonly recordMetric: (input: RecordMetricInput) => Effect.Effect<void, DatabaseError>;

  /**
   * Record multiple metrics in batch
   */
  readonly recordMetricsBatch: (inputs: RecordMetricInput[]) => Effect.Effect<void, DatabaseError>;

  /**
   * Get metrics summary for an organization
   */
  readonly getMetricsSummary: (
    organizationId: string,
    metricType?: MetricType,
    startDate?: Date,
    endDate?: Date,
  ) => Effect.Effect<MetricsSummary[], DatabaseError>;

  /**
   * Get time series data for a specific metric
   */
  readonly getMetricsTimeSeries: (
    organizationId: string,
    metricType: MetricType,
    metricName: string,
    interval: 'hour' | 'day' | 'week',
    startDate?: Date,
    endDate?: Date,
  ) => Effect.Effect<MetricsTimeSeries[], DatabaseError>;

  /**
   * Get performance report for an organization
   */
  readonly getPerformanceReport: (
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ) => Effect.Effect<PerformanceReport, DatabaseError>;

  /**
   * Get recent errors
   */
  readonly getRecentErrors: (
    organizationId: string,
    limit?: number,
  ) => Effect.Effect<PerformanceMetric[], DatabaseError>;

  /**
   * Get slow requests (API response times above threshold)
   */
  readonly getSlowRequests: (
    organizationId: string,
    thresholdMs: number,
    limit?: number,
  ) => Effect.Effect<PerformanceMetric[], DatabaseError>;

  /**
   * Cleanup old metrics
   */
  readonly cleanupOldMetrics: (retentionDays?: number) => Effect.Effect<number, DatabaseError>;
}

// =============================================================================
// Performance Monitoring Service Tag
// =============================================================================

export class PerformanceMonitoring extends Context.Tag('PerformanceMonitoring')<
  PerformanceMonitoring,
  PerformanceMonitoringServiceInterface
>() {}

// =============================================================================
// Performance Monitoring Service Implementation
// =============================================================================

const makePerformanceMonitoringService = Effect.gen(function* () {
  const { db } = yield* Database;

  const recordMetric = (input: RecordMetricInput): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        await db.insert(performanceMetrics).values({
          organizationId: input.organizationId,
          metricType: input.metricType,
          metricName: input.metricName,
          value: input.value,
          userId: input.userId,
          videoId: input.videoId,
          metadata: input.metadata,
          createdAt: new Date(),
        });
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to record metric',
          operation: 'recordMetric',
          cause: error,
        }),
    });

  const recordMetricsBatch = (inputs: RecordMetricInput[]): Effect.Effect<void, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        if (inputs.length === 0) return;

        await db.insert(performanceMetrics).values(
          inputs.map((input) => ({
            organizationId: input.organizationId,
            metricType: input.metricType,
            metricName: input.metricName,
            value: input.value,
            userId: input.userId,
            videoId: input.videoId,
            metadata: input.metadata,
            createdAt: new Date(),
          })),
        );
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to record metrics batch',
          operation: 'recordMetricsBatch',
          cause: error,
        }),
    });

  const getMetricsSummary = (
    organizationId: string,
    metricType?: MetricType,
    startDate?: Date,
    endDate?: Date,
  ): Effect.Effect<MetricsSummary[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const conditions = [eq(performanceMetrics.organizationId, organizationId)];

        if (metricType) {
          conditions.push(eq(performanceMetrics.metricType, metricType));
        }

        if (startDate) {
          conditions.push(gte(performanceMetrics.createdAt, startDate));
        }

        if (endDate) {
          conditions.push(lte(performanceMetrics.createdAt, endDate));
        }

        const result = await db
          .select({
            metricType: performanceMetrics.metricType,
            metricName: performanceMetrics.metricName,
            count: sql<number>`count(*)::int`,
            avgValue: sql<number>`avg(${performanceMetrics.value})::int`,
            minValue: sql<number>`min(${performanceMetrics.value})::int`,
            maxValue: sql<number>`max(${performanceMetrics.value})::int`,
            p50Value: sql<number>`percentile_cont(0.5) within group (order by ${performanceMetrics.value})::int`,
            p95Value: sql<number>`percentile_cont(0.95) within group (order by ${performanceMetrics.value})::int`,
            p99Value: sql<number>`percentile_cont(0.99) within group (order by ${performanceMetrics.value})::int`,
          })
          .from(performanceMetrics)
          .where(and(...conditions))
          .groupBy(performanceMetrics.metricType, performanceMetrics.metricName)
          .orderBy(desc(sql`count(*)`));

        return result.map((r) => ({
          metricType: r.metricType,
          metricName: r.metricName,
          count: r.count,
          avgValue: r.avgValue || 0,
          minValue: r.minValue || 0,
          maxValue: r.maxValue || 0,
          p50Value: r.p50Value || 0,
          p95Value: r.p95Value || 0,
          p99Value: r.p99Value || 0,
        }));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get metrics summary',
          operation: 'getMetricsSummary',
          cause: error,
        }),
    });

  const getMetricsTimeSeries = (
    organizationId: string,
    metricType: MetricType,
    metricName: string,
    interval: 'hour' | 'day' | 'week',
    startDate?: Date,
    endDate?: Date,
  ): Effect.Effect<MetricsTimeSeries[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const conditions = [
          eq(performanceMetrics.organizationId, organizationId),
          eq(performanceMetrics.metricType, metricType),
          eq(performanceMetrics.metricName, metricName),
        ];

        if (startDate) {
          conditions.push(gte(performanceMetrics.createdAt, startDate));
        }

        if (endDate) {
          conditions.push(lte(performanceMetrics.createdAt, endDate));
        }

        const truncateInterval = interval === 'hour' ? 'hour' : interval === 'day' ? 'day' : 'week';

        const result = await db
          .select({
            timestamp: sql<Date>`date_trunc('${sql.raw(truncateInterval)}', ${performanceMetrics.createdAt})`,
            value: sql<number>`avg(${performanceMetrics.value})::int`,
            count: sql<number>`count(*)::int`,
          })
          .from(performanceMetrics)
          .where(and(...conditions))
          .groupBy(sql`date_trunc('${sql.raw(truncateInterval)}', ${performanceMetrics.createdAt})`)
          .orderBy(sql`date_trunc('${sql.raw(truncateInterval)}', ${performanceMetrics.createdAt})`);

        return result.map((r) => ({
          timestamp: r.timestamp,
          value: r.value || 0,
          count: r.count,
        }));
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get metrics time series',
          operation: 'getMetricsTimeSeries',
          cause: error,
        }),
    });

  const getPerformanceReport = (
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Effect.Effect<PerformanceReport, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const conditions = [
          eq(performanceMetrics.organizationId, organizationId),
          gte(performanceMetrics.createdAt, startDate),
          lte(performanceMetrics.createdAt, endDate),
        ];

        // Get summary by type and name
        const summary = await db
          .select({
            metricType: performanceMetrics.metricType,
            metricName: performanceMetrics.metricName,
            count: sql<number>`count(*)::int`,
            avgValue: sql<number>`avg(${performanceMetrics.value})::int`,
            minValue: sql<number>`min(${performanceMetrics.value})::int`,
            maxValue: sql<number>`max(${performanceMetrics.value})::int`,
            p50Value: sql<number>`percentile_cont(0.5) within group (order by ${performanceMetrics.value})::int`,
            p95Value: sql<number>`percentile_cont(0.95) within group (order by ${performanceMetrics.value})::int`,
            p99Value: sql<number>`percentile_cont(0.99) within group (order by ${performanceMetrics.value})::int`,
          })
          .from(performanceMetrics)
          .where(and(...conditions))
          .groupBy(performanceMetrics.metricType, performanceMetrics.metricName);

        // Calculate error rate
        const totalCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(performanceMetrics)
          .where(and(...conditions));

        const errorCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(performanceMetrics)
          .where(and(...conditions, sql`${performanceMetrics.metricType} LIKE '%error%'`));

        const total = totalCount[0]?.count || 0;
        const errors = errorCount[0]?.count || 0;
        const errorRate = total > 0 ? errors / total : 0;

        // Get average video load time
        const videoLoadAvg = await db
          .select({ avg: sql<number>`avg(${performanceMetrics.value})::int` })
          .from(performanceMetrics)
          .where(and(...conditions, eq(performanceMetrics.metricType, 'video_load')));

        // Get average API response time
        const apiResponseAvg = await db
          .select({ avg: sql<number>`avg(${performanceMetrics.value})::int` })
          .from(performanceMetrics)
          .where(and(...conditions, eq(performanceMetrics.metricType, 'api_response')));

        return {
          period: { start: startDate, end: endDate },
          summary: summary.map((s) => ({
            metricType: s.metricType,
            metricName: s.metricName,
            count: s.count,
            avgValue: s.avgValue || 0,
            minValue: s.minValue || 0,
            maxValue: s.maxValue || 0,
            p50Value: s.p50Value || 0,
            p95Value: s.p95Value || 0,
            p99Value: s.p99Value || 0,
          })),
          errorRate,
          avgVideoLoadTime: videoLoadAvg[0]?.avg || 0,
          avgApiResponseTime: apiResponseAvg[0]?.avg || 0,
          totalMetrics: total,
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get performance report',
          operation: 'getPerformanceReport',
          cause: error,
        }),
    });

  const getRecentErrors = (organizationId: string, limit = 50): Effect.Effect<PerformanceMetric[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        return await db
          .select()
          .from(performanceMetrics)
          .where(
            and(
              eq(performanceMetrics.organizationId, organizationId),
              sql`${performanceMetrics.metricType} LIKE '%error%'`,
            ),
          )
          .orderBy(desc(performanceMetrics.createdAt))
          .limit(limit);
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get recent errors',
          operation: 'getRecentErrors',
          cause: error,
        }),
    });

  const getSlowRequests = (
    organizationId: string,
    thresholdMs: number,
    limit = 50,
  ): Effect.Effect<PerformanceMetric[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        return await db
          .select()
          .from(performanceMetrics)
          .where(
            and(
              eq(performanceMetrics.organizationId, organizationId),
              eq(performanceMetrics.metricType, 'api_response'),
              sql`${performanceMetrics.value} > ${thresholdMs}`,
            ),
          )
          .orderBy(desc(performanceMetrics.value))
          .limit(limit);
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get slow requests',
          operation: 'getSlowRequests',
          cause: error,
        }),
    });

  const cleanupOldMetrics = (retentionDays = 30): Effect.Effect<number, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const threshold = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

        const result = await db
          .delete(performanceMetrics)
          .where(sql`${performanceMetrics.createdAt} < ${threshold}`)
          .returning({ id: performanceMetrics.id });

        return result.length;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to cleanup old metrics',
          operation: 'cleanupOldMetrics',
          cause: error,
        }),
    });

  return {
    recordMetric,
    recordMetricsBatch,
    getMetricsSummary,
    getMetricsTimeSeries,
    getPerformanceReport,
    getRecentErrors,
    getSlowRequests,
    cleanupOldMetrics,
  } satisfies PerformanceMonitoringServiceInterface;
});

// =============================================================================
// Performance Monitoring Layer
// =============================================================================

export const PerformanceMonitoringLive = Layer.effect(PerformanceMonitoring, makePerformanceMonitoringService);

// =============================================================================
// Helper Functions
// =============================================================================

export const recordMetric = (input: RecordMetricInput): Effect.Effect<void, DatabaseError, PerformanceMonitoring> =>
  Effect.gen(function* () {
    const service = yield* PerformanceMonitoring;
    return yield* service.recordMetric(input);
  });

export const getPerformanceReport = (
  organizationId: string,
  startDate: Date,
  endDate: Date,
): Effect.Effect<PerformanceReport, DatabaseError, PerformanceMonitoring> =>
  Effect.gen(function* () {
    const service = yield* PerformanceMonitoring;
    return yield* service.getPerformanceReport(organizationId, startDate, endDate);
  });
