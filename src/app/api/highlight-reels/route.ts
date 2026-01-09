import { Effect, Option } from 'effect';
import type { NextRequest } from 'next/server';
import { createFullLayer, handleEffectExit, handleEffectExitWithStatus } from '@/lib/api-handler';
import { ClipRepository, OrganizationRepository, ValidationError } from '@/lib/effect';
import { Auth } from '@/lib/effect/services/auth';
import { validateQueryParams, validateRequestBody } from '@/lib/validation';
import { CreateHighlightReelSchema, PaginationSchema } from '@/lib/validation/schemas';

// =============================================================================
// GET /api/highlight-reels - List all highlight reels for an organization
// =============================================================================

export async function GET(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get active organization
    const orgRepo = yield* OrganizationRepository;
    const organizationOption = yield* orgRepo.getActiveOrganization(user.id);

    if (Option.isNone(organizationOption)) {
      return yield* Effect.fail(new ValidationError({ message: 'No active organization found' }));
    }

    const organization = organizationOption.value;

    // Validate pagination params
    const queryParams = yield* validateQueryParams(PaginationSchema, request.url);

    // Get highlight reels
    const clipRepo = yield* ClipRepository;
    const result = yield* clipRepo.getHighlightReels(organization.id, queryParams.page, queryParams.limit);

    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/highlight-reels - Create a new highlight reel
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    // Authenticate user
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Get active organization
    const orgRepo = yield* OrganizationRepository;
    const organizationOption = yield* orgRepo.getActiveOrganization(user.id);

    if (Option.isNone(organizationOption)) {
      return yield* Effect.fail(new ValidationError({ message: 'No active organization found' }));
    }

    const organization = organizationOption.value;

    // Validate request body
    const validatedData = yield* validateRequestBody(CreateHighlightReelSchema, request);

    // Create highlight reel
    const clipRepo = yield* ClipRepository;
    const newReel = yield* clipRepo.createHighlightReel({
      organizationId: organization.id,
      title: validatedData.title,
      description: validatedData.description ?? undefined,
      clipIds: validatedData.clipIds ? [...validatedData.clipIds] : [],
      createdBy: user.id,
    });

    return { success: true, data: newReel };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExitWithStatus(exit, 201);
}
