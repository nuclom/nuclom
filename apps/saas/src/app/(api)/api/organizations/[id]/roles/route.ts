import { handleEffectExit, runApiEffect } from '@nuclom/lib/api-handler';
import { auth } from '@nuclom/lib/auth';
import { DatabaseError, ForbiddenError, OrganizationRepository, ValidationError } from '@nuclom/lib/effect';
import { Auth } from '@nuclom/lib/effect/services/auth';
import { safeParse } from '@nuclom/lib/validation';
import { Effect, Option, Schema } from 'effect';
import { headers } from 'next/headers';
import type { NextRequest } from 'next/server';

// Schema for creating a role
const CreateRoleSchema = Schema.Struct({
  name: Schema.String,
  permissions: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Array(Schema.String) })),
});

// =============================================================================
// GET /api/organizations/[id]/roles - Get all roles
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id: organizationId } = yield* Effect.promise(() => params);

    // Authenticate and verify membership
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, organizationId);

    // Use Better Auth's dynamic role listing
    const roles = yield* Effect.tryPromise({
      try: async () =>
        auth.api.listOrgRoles({
          query: { organizationId },
          headers: await headers(),
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to get roles',
          operation: 'listOrgRoles',
          cause: error,
        }),
    });

    return {
      success: true,
      data: roles,
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/organizations/[id]/roles - Create a custom role
// =============================================================================

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id: organizationId } = yield* Effect.promise(() => params);

    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Check if user is an owner
    const orgRepo = yield* OrganizationRepository;
    const roleOption = yield* orgRepo.getUserRole(user.id, organizationId);

    if (Option.isNone(roleOption) || roleOption.value !== 'owner') {
      return yield* Effect.fail(
        new ForbiddenError({
          message: 'Only owners can create roles',
        }),
      );
    }

    const rawBody = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () =>
        new ValidationError({
          message: 'Invalid request body',
        }),
    });

    const result = safeParse(CreateRoleSchema, rawBody);
    if (!result.success || !result.data.name) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'Role name is required',
        }),
      );
    }

    const { name, permissions } = result.data;

    // Convert readonly record to mutable
    const mutablePermissions = permissions
      ? Object.fromEntries(Object.entries(permissions).map(([k, v]) => [k, [...v]]))
      : undefined;

    // Use Better Auth's dynamic role creation
    const createdRole = yield* Effect.tryPromise({
      try: async () =>
        auth.api.createOrgRole({
          body: {
            role: name,
            permission: mutablePermissions ?? {},
            organizationId,
          },
          headers: await headers(),
        }),
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create role',
          operation: 'createOrgRole',
          cause: error,
        }),
    });

    return {
      success: true,
      data: createdRole,
    };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}
