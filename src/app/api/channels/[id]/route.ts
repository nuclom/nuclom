import { Effect, Option, Schema } from 'effect';
import type { NextRequest } from 'next/server';
import { handleEffectExit, resolveParams, runApiEffect } from '@/lib/api-handler';
import { ForbiddenError } from '@/lib/effect';
import { Auth } from '@/lib/effect/services/auth';
import { ChannelRepository } from '@/lib/effect/services/channel-repository';
import { OrganizationRepository } from '@/lib/effect/services/organization-repository';
import { validateRequestBody } from '@/lib/validation';

const UpdateChannelSchema = Schema.Struct({
  name: Schema.optional(Schema.String),
  description: Schema.optional(Schema.NullOr(Schema.String)),
});

// =============================================================================
// GET /api/channels/[id] - Get channel details
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id } = yield* resolveParams(params);
    const channelRepo = yield* ChannelRepository;
    const orgRepo = yield* OrganizationRepository;

    const channel = yield* channelRepo.getChannel(id);

    // Verify user has access to this channel's organization
    const isMemberResult = yield* orgRepo.isMember(user.id, channel.organizationId);
    if (!isMemberResult) {
      return yield* Effect.fail(
        new ForbiddenError({
          message: 'Access denied',
          resource: 'Channel',
        }),
      );
    }

    return channel;
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}

// =============================================================================
// PATCH /api/channels/[id] - Update channel
// =============================================================================

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { name, description } = yield* validateRequestBody(UpdateChannelSchema, request);

    const { id } = yield* resolveParams(params);
    const channelRepo = yield* ChannelRepository;
    const orgRepo = yield* OrganizationRepository;

    // Get channel to verify access
    const channel = yield* channelRepo.getChannel(id);

    // Verify user has access to this channel's organization
    const isMemberResult = yield* orgRepo.isMember(user.id, channel.organizationId);
    if (!isMemberResult) {
      return yield* Effect.fail(
        new ForbiddenError({
          message: 'Access denied',
          resource: 'Channel',
        }),
      );
    }

    const updateData: { name?: string; description?: string | null } = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() ?? null;

    const updatedChannel = yield* channelRepo.updateChannel(id, updateData);
    return updatedChannel;
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}

// =============================================================================
// DELETE /api/channels/[id] - Delete channel
// =============================================================================

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const { id } = yield* resolveParams(params);
    const channelRepo = yield* ChannelRepository;
    const orgRepo = yield* OrganizationRepository;

    // Get channel to verify access
    const channel = yield* channelRepo.getChannel(id);

    // Verify user is an owner of this channel's organization
    const userRole = yield* orgRepo.getUserRole(user.id, channel.organizationId);
    if (Option.isNone(userRole) || userRole.value !== 'owner') {
      return yield* Effect.fail(
        new ForbiddenError({
          message: 'Only organization owners can delete channels',
          resource: 'Channel',
        }),
      );
    }

    yield* channelRepo.deleteChannel(id);
    return { message: 'Channel deleted successfully' };
  });

  const exit = await runApiEffect(effect);
  return handleEffectExit(exit);
}
