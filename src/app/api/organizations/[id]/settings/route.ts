import { Cause, Effect, Exit, Option, Schema } from "effect";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { createPublicLayer, mapErrorToApiResponse } from "@/lib/api-handler";
import { auth } from "@/lib/auth";
import { OrganizationRepository } from "@/lib/effect/services/organization-repository";
import type { ApiResponse } from "@/lib/types";
import { safeParse } from "@/lib/validation";

const UpdateOrganizationSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  slug: Schema.optional(Schema.String),
  logo: Schema.optional(Schema.NullOr(Schema.String)),
  metadata: Schema.optional(Schema.String),
});

// =============================================================================
// GET /api/organizations/[id]/settings - Get organization settings
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const orgRepo = yield* OrganizationRepository;

    // Check if user is a member
    const isMemberResult = yield* orgRepo.isMember(session.user.id, resolvedParams.id);
    if (!isMemberResult) {
      return yield* Effect.fail({ _tag: "ForbiddenError", message: "Access denied" });
    }

    const organization = yield* orgRepo.getOrganization(resolvedParams.id);
    return organization;
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

// =============================================================================
// PATCH /api/organizations/[id]/settings - Update organization settings
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request.json();
  const result = safeParse(UpdateOrganizationSchema, rawBody);
  if (!result.success) {
    return NextResponse.json({ success: false, error: "Invalid request format" }, { status: 400 });
  }
  const { name, slug, logo, metadata } = result.data;

  const effect = Effect.gen(function* () {
    const resolvedParams = yield* Effect.promise(() => params);
    const orgRepo = yield* OrganizationRepository;

    // Check if user is an owner
    const userRole = yield* orgRepo.getUserRole(session.user.id, resolvedParams.id);
    if (Option.isNone(userRole) || userRole.value !== "owner") {
      return yield* Effect.fail({
        _tag: "ForbiddenError",
        message: "Only organization owners can update settings",
      });
    }

    // Validate slug format if provided
    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      return yield* Effect.fail({
        _tag: "ValidationError",
        message: "Slug can only contain lowercase letters, numbers, and hyphens",
      });
    }

    const updateData: { name?: string; slug?: string; logo?: string | null; metadata?: string } = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (logo !== undefined) updateData.logo = logo;
    if (metadata !== undefined) updateData.metadata = metadata;

    const updatedOrg = yield* orgRepo.updateOrganization(resolvedParams.id, updateData);

    return { message: "Organization settings updated successfully", organization: updatedOrg };
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
