import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { Auth, createFullLayer, handleEffectExit } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { videoShareLinks, videos } from "@/lib/db/schema";
import { DatabaseError, MissingFieldError, NotFoundError, ValidationError } from "@/lib/effect";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// Hash Password Helper
// =============================================================================

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
    const data = links.map((link) => ({
      ...link,
      password: link.password ? true : null, // Just indicate if password is set
    }));

    const response: ApiResponse = {
      success: true,
      data,
    };
    return response;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
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
    if (body.password?.trim()) {
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

    const data = {
      ...result[0],
      password: hashedPassword ? true : null, // Don't expose hash
    };

    const response: ApiResponse = {
      success: true,
      data,
    };
    return response;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  if (exit._tag === "Success") {
    return NextResponse.json(exit.value, { status: 201 });
  }

  return handleEffectExit(exit);
}
