/**
 * Google Drive Files API
 *
 * Provides endpoints for browsing and importing videos from Google Drive.
 * This is separate from Meet recordings - allows browsing any video files.
 */

import { Cause, Effect, Exit, Layer, Option, Schema } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { NotFoundError, UnauthorizedError } from "@/lib/effect/errors";
import { DatabaseLive } from "@/lib/effect/services/database";
import { type GoogleDriveSearchOptions, GoogleMeet, GoogleMeetLive } from "@/lib/effect/services/google-meet";
import { IntegrationRepository, IntegrationRepositoryLive } from "@/lib/effect/services/integration-repository";
import { logger } from "@/lib/logger";
import { safeParse } from "@/lib/validation";

const IntegrationRepositoryWithDeps = IntegrationRepositoryLive.pipe(Layer.provide(DatabaseLive));
const DriveLayer = Layer.mergeAll(IntegrationRepositoryWithDeps, DatabaseLive, GoogleMeetLive);

const ImportDriveFilesSchema = Schema.Struct({
  files: Schema.Array(
    Schema.Struct({
      fileId: Schema.String,
      name: Schema.String,
      size: Schema.Number,
    }),
  ),
});

// =============================================================================
// GET /api/integrations/google/drive - List videos and folders from Google Drive
// =============================================================================

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Query parameters
  const action = searchParams.get("action") || "list"; // list, search, folders
  const folderId = searchParams.get("folderId") || undefined;
  const query = searchParams.get("query") || undefined;
  const pageSizeParam = searchParams.get("pageSize");
  const pageSize = pageSizeParam ? Number.parseInt(pageSizeParam, 10) : 50;
  const pageToken = searchParams.get("pageToken") || undefined;
  const orderBy = (searchParams.get("orderBy") as GoogleDriveSearchOptions["orderBy"]) || "modifiedTime";
  const orderDirection = (searchParams.get("orderDirection") as GoogleDriveSearchOptions["orderDirection"]) || "desc";

  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const integrationRepo = yield* IntegrationRepository;
    const google = yield* GoogleMeet;

    // Check if Google integration is configured
    if (!google.isConfigured) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Google integration is not configured",
          entity: "Integration",
        }),
      );
    }

    // Get user's Google integration
    const integration = yield* integrationRepo.getIntegrationByProvider(session.user.id, "google_meet");

    if (!integration) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Google account not connected. Please connect your Google account first.",
          entity: "Integration",
        }),
      );
    }

    // Check if token is expired and refresh if needed
    let accessToken = integration.accessToken;
    if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
      if (!integration.refreshToken) {
        return yield* Effect.fail(
          new UnauthorizedError({
            message: "Access token expired. Please reconnect your Google account.",
          }),
        );
      }

      const newTokens = yield* google.refreshAccessToken(integration.refreshToken);
      accessToken = newTokens.access_token;

      yield* integrationRepo.updateIntegration(integration.id, {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || integration.refreshToken,
        expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
      });
    }

    // Handle different actions
    switch (action) {
      case "search": {
        if (!query) {
          return { files: [], folders: [], nextPageToken: undefined };
        }
        const searchResult = yield* google.searchVideos(accessToken, query, pageSize, pageToken);
        return {
          files: searchResult.files,
          folders: [],
          nextPageToken: searchResult.nextPageToken,
        };
      }

      case "folders": {
        const foldersResult = yield* google.listFolders(accessToken, folderId, pageSize, pageToken);
        return {
          files: [],
          folders: foldersResult.folders,
          nextPageToken: foldersResult.nextPageToken,
        };
      }

      default: {
        // List both folders and files in the current directory (action "list" or any other)
        const [filesResult, foldersResult] = yield* Effect.all([
          google.listVideoFiles(accessToken, {
            folderId,
            pageSize,
            pageToken,
            orderBy,
            orderDirection,
          }),
          google.listFolders(accessToken, folderId, 100),
        ]);

        return {
          files: filesResult.files,
          folders: foldersResult.folders,
          nextPageToken: filesResult.nextPageToken,
          currentFolderId: folderId || "root",
        };
      }
    }
  });

  const exit = await Effect.runPromiseExit(Effect.provide(effect, DriveLayer));

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (Option.isSome(error)) {
        const err = error.value;
        if (err instanceof NotFoundError) {
          return NextResponse.json({ success: false, error: err.message }, { status: 404 });
        }
        if (err instanceof UnauthorizedError) {
          return NextResponse.json({ success: false, error: err.message }, { status: 401 });
        }
      }
      logger.error("[Google Drive API Error]", cause instanceof Error ? cause : new Error(String(cause)));
      return NextResponse.json({ success: false, error: "Failed to fetch Google Drive files" }, { status: 500 });
    },
    onSuccess: (data) => {
      return NextResponse.json({ success: true, data });
    },
  });
}

// =============================================================================
// POST /api/integrations/google/drive - Import videos from Google Drive
// =============================================================================

export async function POST(request: NextRequest) {
  // Verify authentication
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate request body
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
  }

  const result = safeParse(ImportDriveFilesSchema, rawBody);
  if (!result.success) {
    return NextResponse.json({ success: false, error: "Invalid request format" }, { status: 400 });
  }
  const { files } = result.data;

  if (files.length === 0) {
    return NextResponse.json({ success: false, error: "No files to import" }, { status: 400 });
  }

  // Limit to 20 files at a time
  if (files.length > 20) {
    return NextResponse.json({ success: false, error: "Maximum 20 files can be imported at once" }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    const integrationRepo = yield* IntegrationRepository;
    const google = yield* GoogleMeet;

    // Check if Google integration is configured
    if (!google.isConfigured) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Google integration is not configured",
          entity: "Integration",
        }),
      );
    }

    // Get user's Google integration
    const integration = yield* integrationRepo.getIntegrationByProvider(session.user.id, "google_meet");

    if (!integration) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Google account not connected",
          entity: "Integration",
        }),
      );
    }

    // Check if token is expired and refresh if needed
    let accessToken = integration.accessToken;
    if (integration.expiresAt && new Date(integration.expiresAt) < new Date()) {
      if (!integration.refreshToken) {
        return yield* Effect.fail(
          new UnauthorizedError({
            message: "Access token expired. Please reconnect your Google account.",
          }),
        );
      }

      const newTokens = yield* google.refreshAccessToken(integration.refreshToken);
      accessToken = newTokens.access_token;

      yield* integrationRepo.updateIntegration(integration.id, {
        accessToken: newTokens.access_token,
        refreshToken: newTokens.refresh_token || integration.refreshToken,
        expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
      });
    }

    // Prepare recordings for import using existing import workflow
    const recordings = files.map((file) => ({
      externalId: file.fileId,
      downloadUrl: `https://www.googleapis.com/drive/v3/files/${file.fileId}?alt=media`,
      title: file.name.replace(/\.[^/.]+$/, ""), // Remove extension for title
      fileSize: file.size,
      meetingDate: undefined,
      duration: undefined,
    }));

    // Return the prepared recordings to be used with the existing import API
    return {
      provider: "google_meet" as const,
      recordings,
      integrationId: integration.id,
      accessToken,
    };
  });

  const exit = await Effect.runPromiseExit(Effect.provide(effect, DriveLayer));

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (Option.isSome(error)) {
        const err = error.value;
        if (err instanceof NotFoundError) {
          return NextResponse.json({ success: false, error: err.message }, { status: 404 });
        }
        if (err instanceof UnauthorizedError) {
          return NextResponse.json({ success: false, error: err.message }, { status: 401 });
        }
      }
      logger.error("[Google Drive Import Error]", cause instanceof Error ? cause : new Error(String(cause)));
      return NextResponse.json({ success: false, error: "Failed to prepare import" }, { status: 500 });
    },
    onSuccess: (data) => {
      return NextResponse.json({ success: true, data });
    },
  });
}
