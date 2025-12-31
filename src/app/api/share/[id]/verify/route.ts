import { eq } from "drizzle-orm";
import { Cause, Effect, Exit } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { videoShareLinks } from "@/lib/db/schema";
import { AppLive, DatabaseError, MissingFieldError, NotFoundError, ValidationError } from "@/lib/effect";
import type { ApiResponse } from "@/lib/types";

// =============================================================================
// Error Response Handler
// =============================================================================

const mapErrorToResponse = (error: unknown): NextResponse => {
  if (error && typeof error === "object" && "_tag" in error) {
    const taggedError = error as { _tag: string; message: string };

    switch (taggedError._tag) {
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
// POST /api/share/[id]/verify - Verify password for protected share link
// =============================================================================

interface VerifyPasswordBody {
  password: string;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id } = yield* Effect.promise(() => params);

    // Parse request body
    const body = yield* Effect.tryPromise({
      try: () => request.json() as Promise<VerifyPasswordBody>,
      catch: () =>
        new MissingFieldError({
          field: "body",
          message: "Invalid request body",
        }),
    });

    if (!body.password) {
      return yield* Effect.fail(
        new MissingFieldError({
          field: "password",
          message: "Password is required",
        }),
      );
    }

    // Get share link
    const shareLink = yield* Effect.tryPromise({
      try: () =>
        db.query.videoShareLinks.findFirst({
          where: eq(videoShareLinks.id, id),
        }),
      catch: (error) =>
        new DatabaseError({
          message: "Failed to fetch share link",
          operation: "getShareLink",
          cause: error,
        }),
    });

    if (!shareLink) {
      return yield* Effect.fail(
        new NotFoundError({
          message: "Share link not found",
          entity: "VideoShareLink",
          id,
        }),
      );
    }

    if (!shareLink.password) {
      return yield* Effect.fail(
        new ValidationError({
          message: "This share link is not password protected",
        }),
      );
    }

    // Hash the provided password and compare
    const hashedPassword = yield* Effect.tryPromise({
      try: () => hashPassword(body.password),
      catch: () =>
        new DatabaseError({
          message: "Failed to hash password",
          operation: "hashPassword",
        }),
    });

    if (hashedPassword !== shareLink.password) {
      return yield* Effect.fail(
        new ValidationError({
          message: "Incorrect password",
        }),
      );
    }

    return { verified: true };
  });

  const runnable = Effect.provide(effect, AppLive);
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
