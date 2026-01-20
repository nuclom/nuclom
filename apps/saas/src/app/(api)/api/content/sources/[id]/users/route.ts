/**
 * API: Content Source Users
 *
 * GET /api/content/sources/[id]/users - List external users from this source
 *
 * Query params:
 * - linked: 'true' | 'false' | undefined - Filter by link status
 */

import { Auth, createFullLayer, handleEffectExit } from '@nuclom/lib/api-handler';
import { db } from '@nuclom/lib/db';
import { contentItems, contentParticipants, contentSources, members, users } from '@nuclom/lib/db/schema';
import { OrganizationRepository } from '@nuclom/lib/effect';
import { and, eq, isNotNull } from 'drizzle-orm';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Types
// =============================================================================

interface ExternalUser {
  externalId: string;
  name: string;
  email: string | null;
  itemCount: number;
  linkedUserId: string | null;
  linkedUserName: string | null;
  linkedUserEmail: string | null;
  linkedUserImage: string | null;
  // Suggested matches based on email/name
  suggestions: Array<{
    userId: string;
    name: string | null;
    email: string | null;
    image: string | null;
    confidence: number;
    reason: string;
  }>;
}

// =============================================================================
// GET /api/content/sources/[id]/users
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    const { id: sourceId } = yield* Effect.promise(() => params);
    const url = new URL(request.url);
    const linkedFilter = url.searchParams.get('linked');

    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Fetch source first
    const source = yield* Effect.tryPromise({
      try: () =>
        db.query.contentSources.findFirst({
          where: eq(contentSources.id, sourceId),
        }),
      catch: (e) => new Error(`Failed to fetch source: ${e}`),
    });

    if (!source) {
      return yield* Effect.fail(new Error('Source not found'));
    }

    // Verify user has access to the organization
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, source.organizationId);

    // Get unique external users from both contentItems (authorExternal) and contentParticipants (externalId)
    // We'll use UNION to combine both sources

    // First, get external users from contentItems
    const itemAuthors = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            externalId: contentItems.authorExternal,
            name: contentItems.authorName,
            linkedUserId: contentItems.authorId,
          })
          .from(contentItems)
          .where(and(eq(contentItems.sourceId, sourceId), isNotNull(contentItems.authorExternal))),
      catch: (e) => new Error(`Failed to fetch item authors: ${e}`),
    });

    // Second, get external users from contentParticipants
    const participants = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            externalId: contentParticipants.externalId,
            name: contentParticipants.name,
            email: contentParticipants.email,
            linkedUserId: contentParticipants.userId,
          })
          .from(contentParticipants)
          .innerJoin(contentItems, eq(contentParticipants.contentItemId, contentItems.id))
          .where(and(eq(contentItems.sourceId, sourceId), isNotNull(contentParticipants.externalId))),
      catch: (e) => new Error(`Failed to fetch participants: ${e}`),
    });

    // Combine and dedupe by externalId
    const externalUserMap = new Map<
      string,
      { name: string; email: string | null; linkedUserId: string | null; count: number }
    >();

    for (const author of itemAuthors) {
      if (author.externalId) {
        const existing = externalUserMap.get(author.externalId);
        if (existing) {
          existing.count++;
          // Keep the most recent linkedUserId if any
          if (author.linkedUserId) existing.linkedUserId = author.linkedUserId;
        } else {
          externalUserMap.set(author.externalId, {
            name: author.name || author.externalId,
            email: null,
            linkedUserId: author.linkedUserId,
            count: 1,
          });
        }
      }
    }

    for (const participant of participants) {
      if (participant.externalId) {
        const existing = externalUserMap.get(participant.externalId);
        if (existing) {
          existing.count++;
          // Keep email if we find one
          if (participant.email && !existing.email) existing.email = participant.email;
          // Keep the most recent linkedUserId if any
          if (participant.linkedUserId) existing.linkedUserId = participant.linkedUserId;
        } else {
          externalUserMap.set(participant.externalId, {
            name: participant.name || participant.externalId,
            email: participant.email,
            linkedUserId: participant.linkedUserId,
            count: 1,
          });
        }
      }
    }

    // Apply linked filter
    let filteredEntries = Array.from(externalUserMap.entries());
    if (linkedFilter === 'true') {
      filteredEntries = filteredEntries.filter(([, data]) => data.linkedUserId !== null);
    } else if (linkedFilter === 'false') {
      filteredEntries = filteredEntries.filter(([, data]) => data.linkedUserId === null);
    }

    // Get org members for suggestions and to resolve linked user details
    const orgMembers = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            userId: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          })
          .from(members)
          .innerJoin(users, eq(members.userId, users.id))
          .where(eq(members.organizationId, source.organizationId)),
      catch: (e) => new Error(`Failed to fetch org members: ${e}`),
    });

    // Build result with suggestions
    const result: ExternalUser[] = filteredEntries.map(([externalId, data]) => {
      // Find linked user details if any
      const linkedUser = data.linkedUserId ? orgMembers.find((m) => m.userId === data.linkedUserId) : null;

      // Generate suggestions based on email and name matching
      const suggestions: ExternalUser['suggestions'] = [];

      if (!data.linkedUserId) {
        for (const member of orgMembers) {
          let confidence = 0;
          let reason = '';

          // Exact email match is high confidence
          if (data.email && member.email && data.email.toLowerCase() === member.email.toLowerCase()) {
            confidence = 0.95;
            reason = 'Email match';
          }
          // Name contains match
          else if (
            member.name &&
            data.name &&
            (member.name.toLowerCase().includes(data.name.toLowerCase()) ||
              data.name.toLowerCase().includes(member.name.toLowerCase()))
          ) {
            confidence = 0.7;
            reason = 'Name similarity';
          }
          // Email username matches name
          else if (member.email && data.name) {
            const emailUsername = member.email
              .split('@')[0]
              ?.toLowerCase()
              .replace(/[^a-z]/g, '');
            const nameLower = data.name.toLowerCase().replace(/[^a-z]/g, '');
            if (
              emailUsername &&
              nameLower &&
              (emailUsername.includes(nameLower) || nameLower.includes(emailUsername))
            ) {
              confidence = 0.5;
              reason = 'Email/name correlation';
            }
          }

          if (confidence > 0) {
            suggestions.push({
              userId: member.userId,
              name: member.name,
              email: member.email,
              image: member.image,
              confidence,
              reason,
            });
          }
        }

        // Sort suggestions by confidence
        suggestions.sort((a, b) => b.confidence - a.confidence);
      }

      return {
        externalId,
        name: data.name,
        email: data.email,
        itemCount: data.count,
        linkedUserId: data.linkedUserId,
        linkedUserName: linkedUser?.name || null,
        linkedUserEmail: linkedUser?.email || null,
        linkedUserImage: linkedUser?.image || null,
        suggestions: suggestions.slice(0, 3), // Top 3 suggestions
      };
    });

    // Sort by item count (most active users first)
    result.sort((a, b) => b.itemCount - a.itemCount);

    return {
      users: result,
      total: result.length,
      linked: result.filter((u) => u.linkedUserId !== null).length,
      unlinked: result.filter((u) => u.linkedUserId === null).length,
    };
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);

  return handleEffectExit(exit);
}
