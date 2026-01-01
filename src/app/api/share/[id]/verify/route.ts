import { eq } from "drizzle-orm";
import { Cause, Effect, Exit } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { createPublicLayer, mapErrorToApiResponse } from "@/lib/api-handler";
import { db } from "@/lib/db";
import { videoShareLinks } from "@/lib/db/schema";
import { DatabaseError, MissingFieldError, NotFoundError, ValidationError } from "@/lib/effect";
import type { ApiResponse } from "@/lib/types";

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

  const runnable = Effect.provide(effect, createPublicLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToApiResponse(error.value);
      }
      return mapErrorToApiResponse(new Error("Internal server error"));
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
