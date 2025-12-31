import { eq } from "drizzle-orm";
import { Cause, Effect, Exit, Layer } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { videoShareLinks, videos } from "@/lib/db/schema";
import { AppLive, DatabaseError, MissingFieldError, NotFoundError, ValidationError } from "@/lib/effect";
import { Auth, makeAuthLayer } from "@/lib/effect/services/auth";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// Error Response Handler
// =============================================================================

const mapErrorToResponse = (error: unknown): NextResponse => {
  if (error && typeof error === "object" && "_tag" in error) {
    const taggedError = error as { _tag: string; message: string };

    switch (taggedError._tag) {
      case "UnauthorizedError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 401 });
      case "NotFoundError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 404 });
      case "ValidationError":
      case "MissingFieldError":
        return NextResponse.json({ success: false, error: taggedError.message }, { status: 400 });
      default:
        console.error(`[${taggedError._tag}]`, taggedError);
        return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    }
  }
  console.error("[Error]", error);
  return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
};

// Hash password using Web Crypto API
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// =============================================================================
// GET /api/videos/[id]/share - List share links for video
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    yield* authService.getSession(request.headers);

    const { id } = yield* Effect.promise(() => params);

    // Get share links for video with creator info
    const links = yield* Effect.tryPromise({
      try: () =>
        db.query.videoShareLinks.findMany({
          where: eq(videoShareLinks.videoId, id),
          with: {
            creator: {
              columns: { name: true },
            },
          },
          orderBy: (links, { desc }) => [desc(links.createdAt)],
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch share links",
          operation: "getShareLinks",
          cause: error,
        }),
    });

    // Don't expose password hashes
    return links.map((link) => ({
      ...link,
      password: link.password ? true : null, // Just indicate if password is set
    }));
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToResponse(error.value);
      }
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => {
      const response: ApiResponse = {
        success: true,
        data,
      };
      return NextResponse.json(response);
    },
  });
}

// =============================================================================
// POST /api/videos/[id]/share - Create share link
// =============================================================================

interface CreateShareLinkBody {
  accessLevel?: "view" | "comment" | "download";
  password?: string;
  expiresIn?: "never" | "1d" | "7d" | "30d";
  maxViews?: number;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);

  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id } = yield* Effect.promise(() => params);

    // Parse request body
    const body = yield* Effect.tryPromise({
      try: () => request.json() as Promise<CreateShareLinkBody>,
      catch: () =>
        new MissingFieldError({
          field: "body",
          message: "Invalid request body",
        }),
    });

    // Verify video exists
    const video = yield* Effect.tryPromise({
      try: () => db.query.videos.findFirst({ where: eq(videos.id, id) }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch video",
          operation: "getVideo",
          cause: error,
        }),
    });

    if (!video) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Video not found",
          entity: "Video",
          id,
        }),
      );
    }

    // Validate access level
    const validAccessLevels = ["view", "comment", "download"] as const;
    const accessLevel = body.accessLevel || "view";
    if (!validAccessLevels.includes(accessLevel)) {
      return yield* Effect.fail(
        new ValidationError({
          message: `Invalid access level. Valid levels: ${validAccessLevels.join(", ")}`,
        }),
      );
    }

    // Calculate expiration date
    let expiresAt: Date | null = null;
    if (body.expiresIn && body.expiresIn !== "never") {
      const now = new Date();
      switch (body.expiresIn) {
        case "1d":
          expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          break;
        case "7d":
          expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
      }
    }

    // Hash password if provided
    let hashedPassword: string | null = null;
    if (body.password && body.password.trim()) {
      hashedPassword = yield* Effect.tryPromise({
        try: () => hashPassword(body.password as string),
        catch: () =>
          new DatabaseError({
            message: "Failed to hash password",
            operation: "hashPassword",
          }),
      });
    }

    // Create share link
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(videoShareLinks)
          .values({
            videoId: id,
            createdBy: user.id,
            accessLevel,
            password: hashedPassword,
            expiresAt,
            maxViews: body.maxViews || null,
          })
          .returning(),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to create share link",
          operation: "createShareLink",
          cause: error,
        }),
    });

    return {
      ...result[0],
      password: hashedPassword ? true : null, // Don't expose hash
    };
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToResponse(error.value);
      }
      return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => {
      const response: ApiResponse = {
        success: true,
        data,
      };
      return NextResponse.json(response, { status: 201 });
    },
  });
}
