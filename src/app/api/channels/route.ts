import { Effect, Option, Schema } from 'effect';
import type { NextRequest } from 'next/server';
import { handleEffectExit, handleEffectExitWithStatus, runApiEffect } from '@/lib/api-handler';
import { ValidationError } from '@/lib/effect';
import { Auth } from '@/lib/effect/services/auth';
import { ChannelRepository } from '@/lib/effect/services/channel-repository';
import { OrganizationRepository } from '@/lib/effect/services/organization-repository';
import { validateRequestBody } from '@/lib/validation';

const CreateChannelSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.minLength(1)),
  description: Schema.optional(Schema.String),
});

// =============================================================================
// GET /api/channels - Get channels for the active organization
// =============================================================================

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const page = Number.parseInt(url.searchParams.get('page') ?? '1', 10);
  const limit = Number.parseInt(url.searchParams.get('limit') ?? '20', 10);

  const effect = Effect.gen(function* () {
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const orgRepo = yield* OrganizationRepository;
    const activeOrg = yield* orgRepo.getActiveOrganization(user.id);

    if (Option.isNone(activeOrg)) {
      return {
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      };
    }

    const channelRepo = yield* ChannelRepository;
    return yield* channelRepo.getChannels(activeOrg.value.id, page, limit);
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}

// =============================================================================
// POST /api/channels - Create a new channel
// =============================================================================

export async function POST(request: NextRequest) {
  const effect = Effect.gen(function* () {
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { name, description } = yield* validateRequestBody(CreateChannelSchema, request);

    const orgRepo = yield* OrganizationRepository;
    const activeOrg = yield* orgRepo.getActiveOrganization(user.id);

    if (Option.isNone(activeOrg)) {
      return yield* Effect.fail(
        new ValidationError({
          message: 'No active organization found',
        }),
      );
    }

    const channelRepo = yield* ChannelRepository;
    const newChannel = yield* channelRepo.createChannel({
      name: name.trim(),
      description: description?.trim(),
      organizationId: activeOrg.value.id,
    });

    return newChannel;
  });

  const exit = await runApiEffect(effect);
  return handleEffectExitWithStatus(exit, 201);
}
