/**
 * Reports API Route
 *
 * Handles content reporting functionality using Effect-TS for type-safe error handling.
 *
 * - GET /api/reports - List reports (admin only)
 * - POST /api/reports - Create a new report
 * - PATCH /api/reports - Update a report (admin only)
 */

import { and, count, desc, eq } from 'drizzle-orm';
import { Effect, Schema } from 'effect';
import type { NextRequest } from 'next/server';
import { createFullLayer, handleEffectExit, handleEffectExitWithStatus } from '@/lib/api-handler';
import type { ReportCategory, ReportResourceType, ReportStatus } from '@/lib/db/schema';
import { reportCategoryEnum, reportResourceTypeEnum, reportStatusEnum, reports, users } from '@/lib/db/schema';
import { DuplicateError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/effect/errors';
import { Auth } from '@/lib/effect/services/auth';
import { Database } from '@/lib/effect/services/database';
import { createBodyValidator, createQueryValidator } from '@/lib/validation';

// =============================================================================
// Validation Schemas
// =============================================================================

/** Query parameters for listing reports */
const ListReportsQuerySchema = Schema.Struct({
  status: Schema.optional(Schema.String),
  category: Schema.optional(Schema.String),
  resourceType: Schema.optional(Schema.String),
  page: Schema.optional(Schema.String),
  limit: Schema.optional(Schema.String),
});

/** Request body for creating a report */
const CreateReportSchema = Schema.Struct({
  resourceType: Schema.Literal('video', 'comment', 'user'),
  resourceId: Schema.String,
  category: Schema.Literal('inappropriate', 'spam', 'copyright', 'harassment', 'other'),
  description: Schema.optional(Schema.String),
});

/** Request body for updating a report (admin only) */
const UpdateReportSchema = Schema.Struct({
  reportId: Schema.String,
  status: Schema.optional(Schema.Literal('pending', 'reviewing', 'resolved', 'dismissed')),
  resolution: Schema.optional(Schema.Literal('content_removed', 'user_warned', 'user_suspended', 'no_action')),
  resolutionNotes: Schema.optional(Schema.String),
});

// Type-safe validators
const listReportsQuery = createQueryValidator(ListReportsQuerySchema);
const createReportBody = createBodyValidator(CreateReportSchema);
const updateReportBody = createBodyValidator(UpdateReportSchema);

// =============================================================================
// Helper Functions
// =============================================================================

/** Validate report status against enum values */
function isValidReportStatus(value: string | undefined): value is ReportStatus {
  if (!value) return false;
  return (reportStatusEnum.enumValues as readonly string[]).includes(value);
}

/** Validate report category against enum values */
function isValidReportCategory(value: string | undefined): value is ReportCategory {
  if (!value) return false;
  return (reportCategoryEnum.enumValues as readonly string[]).includes(value);
}

/** Validate report resource type against enum values */
function isValidReportResourceType(value: string | undefined): value is ReportResourceType {
  if (!value) return false;
  return (reportResourceTypeEnum.enumValues as readonly string[]).includes(value);
}

// =============================================================================
// GET /api/reports - List reports (admin only)
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get database
    const database = yield* Database;
    const db = database.db;

    // Check if user is admin
    const [userData] = yield* Effect.tryPromise({
      try: () => db.select({ role: users.role }).from(users).where(eq(users.id, user.id)).limit(1),
      catch: (error) => new ValidationError({ message: `Failed to fetch user role: ${String(error)}` }),
    });

    if (userData?.role !== 'admin') {
      return yield* Effect.fail(new ForbiddenError({ message: 'Admin access required' }));
    }

    // Parse and validate query params
    const params = yield* listReportsQuery.validate(request.url);

    // Parse pagination
    const page = params.page ? parseInt(params.page, 10) : 1;
    const limit = Math.min(params.limit ? parseInt(params.limit, 10) : 20, 100);
    const offset = (page - 1) * limit;

    // Validate enum params
    const status = isValidReportStatus(params.status) ? params.status : undefined;
    const category = isValidReportCategory(params.category) ? params.category : undefined;
    const resourceType = isValidReportResourceType(params.resourceType) ? params.resourceType : undefined;

    // Build filter conditions
    const conditions = [];
    if (status) conditions.push(eq(reports.status, status));
    if (category) conditions.push(eq(reports.category, category));
    if (resourceType) conditions.push(eq(reports.resourceType, resourceType));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Fetch reports with reporter info
    const [reportsList, totalCount] = yield* Effect.tryPromise({
      try: () =>
        Promise.all([
          db
            .select({
              report: reports,
              reporter: {
                id: users.id,
                name: users.name,
                email: users.email,
                image: users.image,
              },
            })
            .from(reports)
            .leftJoin(users, eq(reports.reporterId, users.id))
            .where(whereClause)
            .orderBy(desc(reports.createdAt))
            .limit(limit)
            .offset(offset),
          db.select({ count: count() }).from(reports).where(whereClause),
        ]),
      catch: (error) => new ValidationError({ message: `Failed to fetch reports: ${String(error)}` }),
    });

    return {
      reports: reportsList.map((r) => ({
        ...r.report,
        reporter: r.reporter,
      })),
      pagination: {
        page,
        limit,
        total: totalCount[0]?.count ?? 0,
        totalPages: Math.ceil((totalCount[0]?.count ?? 0) / limit),
      },
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/reports - Create a new report
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get database
    const database = yield* Database;
    const db = database.db;

    // Validate request body
    const { resourceType, resourceId, category, description } = yield* createReportBody.validate(request);

    // Check for duplicate reports from the same user for the same resource
    const existingReport = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(reports)
          .where(
            and(
              eq(reports.reporterId, user.id),
              eq(reports.resourceType, resourceType),
              eq(reports.resourceId, resourceId),
              eq(reports.status, 'pending'),
            ),
          )
          .limit(1),
      catch: (error) => new ValidationError({ message: `Failed to check existing reports: ${String(error)}` }),
    });

    if (existingReport.length > 0) {
      return yield* Effect.fail(
        new DuplicateError({
          message: 'You have already reported this content',
          entity: 'report',
          field: 'resourceId',
        }),
      );
    }

    // Create the report
    const [newReport] = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(reports)
          .values({
            reporterId: user.id,
            resourceType,
            resourceId,
            category,
            description,
            status: 'pending',
          })
          .returning(),
      catch: (error) => new ValidationError({ message: `Failed to create report: ${String(error)}` }),
    });

    return {
      success: true,
      message: 'Thank you for your report. Our team will review it shortly.',
      reportId: newReport.id,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExitWithStatus(exit, 201);
}

// =============================================================================
// PATCH /api/reports - Update a report (admin only)
// =============================================================================

export async function PATCH(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get database
    const database = yield* Database;
    const db = database.db;

    // Check if user is admin
    const [userData] = yield* Effect.tryPromise({
      try: () => db.select({ role: users.role }).from(users).where(eq(users.id, user.id)).limit(1),
      catch: (error) => new ValidationError({ message: `Failed to fetch user role: ${String(error)}` }),
    });

    if (userData?.role !== 'admin') {
      return yield* Effect.fail(new ForbiddenError({ message: 'Admin access required' }));
    }

    // Validate request body
    const { reportId, status, resolution, resolutionNotes } = yield* updateReportBody.validate(request);

    // Build update object
    const updateObj: Record<string, unknown> = {};
    if (status) updateObj.status = status;
    if (resolution) updateObj.resolution = resolution;
    if (resolutionNotes !== undefined) updateObj.resolutionNotes = resolutionNotes;

    // If status is resolved or dismissed, add resolution info
    if (status === 'resolved' || status === 'dismissed') {
      updateObj.resolvedById = user.id;
      updateObj.resolvedAt = new Date();
    }

    // Update the report
    const [updatedReport] = yield* Effect.tryPromise({
      try: () => db.update(reports).set(updateObj).where(eq(reports.id, reportId)).returning(),
      catch: (error) => new ValidationError({ message: `Failed to update report: ${String(error)}` }),
    });

    if (!updatedReport) {
      return yield* Effect.fail(
        new NotFoundError({
          message: 'Report not found',
          entity: 'report',
          id: reportId,
        }),
      );
    }

    return {
      success: true,
      report: updatedReport,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}
