/**
 * Content Source Users API Route
 *
 * GET /api/content/sources/[id]/users - List external users from a content source
 */

import { Auth, createFullLayer, handleEffectExit, resolveParams } from '@nuclom/lib/api-handler';
import { db } from '@nuclom/lib/db';
import { contentItems, contentParticipants, users } from '@nuclom/lib/db/schema';
import { githubUsers } from '@nuclom/lib/db/schema/github';
import { notionUsers } from '@nuclom/lib/db/schema/notion';
import { slackUsers } from '@nuclom/lib/db/schema/slack';
import { OrganizationRepository } from '@nuclom/lib/effect';
import { getContentSource } from '@nuclom/lib/effect/services/content';
import { and, count, eq, isNotNull, isNull } from 'drizzle-orm';
import { Effect } from 'effect';
import type { NextRequest } from 'next/server';

// =============================================================================
// Types
// =============================================================================

interface Suggestion {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  confidence: number;
  reason: string;
}

interface ExternalUser {
  externalId: string;
  name: string;
  email: string | null;
  itemCount: number;
  linkedUserId: string | null;
  linkedUserName: string | null;
  linkedUserEmail: string | null;
  linkedUserImage: string | null;
  suggestions: Suggestion[];
}

interface UsersResponse {
  users: ExternalUser[];
  total: number;
  linked: number;
  unlinked: number;
}

// =============================================================================
// GET - List External Users
// =============================================================================

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Resolve params
    const { id: sourceId } = yield* resolveParams(params);

    // Get content source
    const source = yield* getContentSource(sourceId);

    // Verify org membership
    const orgRepo = yield* OrganizationRepository;
    yield* orgRepo.isMember(user.id, source.organizationId);

    // Parse query params
    const { searchParams } = new URL(request.url);
    const linkedFilter = searchParams.get('linked');

    // Get external users based on source type
    let externalUsers: ExternalUser[] = [];

    if (source.type === 'slack') {
      externalUsers = yield* getSlackUsers(sourceId, linkedFilter);
    } else if (source.type === 'notion') {
      externalUsers = yield* getNotionUsers(sourceId, linkedFilter);
    } else if (source.type === 'github') {
      externalUsers = yield* getGitHubUsers(sourceId, linkedFilter);
    }

    // Get org members for suggestions
    const orgMembers = yield* Effect.tryPromise({
      try: () =>
        db.query.members.findMany({
          where: (members, { eq }) => eq(members.organizationId, source.organizationId),
          with: { user: true },
        }),
      catch: () => new Error('Failed to get org members'),
    }).pipe(
      Effect.catchAll(() =>
        Effect.succeed(
          [] as {
            userId: string;
            user: { id: string; name: string | null; email: string | null; image: string | null };
          }[],
        ),
      ),
    );

    // Add suggestions based on email matching
    for (const extUser of externalUsers) {
      if (extUser.email && !extUser.linkedUserId) {
        const emailMatch = orgMembers.find((m) => m.user.email?.toLowerCase() === extUser.email?.toLowerCase());
        if (emailMatch) {
          extUser.suggestions.push({
            userId: emailMatch.userId,
            name: emailMatch.user.name,
            email: emailMatch.user.email,
            image: emailMatch.user.image,
            confidence: 0.95,
            reason: 'Email match',
          });
        }
      }
    }

    const linked = externalUsers.filter((u) => u.linkedUserId !== null).length;
    const unlinked = externalUsers.filter((u) => u.linkedUserId === null).length;

    const response: UsersResponse = {
      users: externalUsers,
      total: externalUsers.length,
      linked,
      unlinked,
    };

    return response;
  });

  const runnable = Effect.provide(effect, createFullLayer());
  const exit = await Effect.runPromiseExit(runnable);
  return handleEffectExit(exit);
}

// =============================================================================
// Helper Functions
// =============================================================================

function getSlackUsers(sourceId: string, linkedFilter: string | null) {
  return Effect.tryPromise({
    try: async () => {
      // Build where clause
      const conditions = [eq(slackUsers.sourceId, sourceId)];
      if (linkedFilter === 'true') {
        conditions.push(isNotNull(slackUsers.userId));
      } else if (linkedFilter === 'false') {
        conditions.push(isNull(slackUsers.userId));
      }

      // Get users with linked user info
      const usersWithInfo = await db
        .select({
          externalId: slackUsers.slackUserId,
          name: slackUsers.displayName,
          email: slackUsers.email,
          linkedUserId: slackUsers.userId,
          linkedUser: {
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          },
        })
        .from(slackUsers)
        .leftJoin(users, eq(slackUsers.userId, users.id))
        .where(and(...conditions));

      // Get item counts per external user
      const itemCounts = await db
        .select({
          externalId: contentParticipants.externalId,
          count: count(),
        })
        .from(contentParticipants)
        .innerJoin(contentItems, eq(contentParticipants.contentItemId, contentItems.id))
        .where(eq(contentItems.sourceId, sourceId))
        .groupBy(contentParticipants.externalId);

      const countMap = new Map(itemCounts.map((ic) => [ic.externalId, ic.count]));

      return usersWithInfo.map((u) => ({
        externalId: u.externalId,
        name: u.name,
        email: u.email,
        itemCount: countMap.get(u.externalId) || 0,
        linkedUserId: u.linkedUserId,
        linkedUserName: u.linkedUser?.name || null,
        linkedUserEmail: u.linkedUser?.email || null,
        linkedUserImage: u.linkedUser?.image || null,
        suggestions: [] as Suggestion[],
      }));
    },
    catch: (e) => new Error(`Failed to get Slack users: ${e}`),
  });
}

function getNotionUsers(sourceId: string, linkedFilter: string | null) {
  return Effect.tryPromise({
    try: async () => {
      const conditions = [eq(notionUsers.sourceId, sourceId)];
      if (linkedFilter === 'true') {
        conditions.push(isNotNull(notionUsers.userId));
      } else if (linkedFilter === 'false') {
        conditions.push(isNull(notionUsers.userId));
      }

      const usersWithInfo = await db
        .select({
          externalId: notionUsers.notionUserId,
          name: notionUsers.name,
          email: notionUsers.email,
          linkedUserId: notionUsers.userId,
          linkedUser: {
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          },
        })
        .from(notionUsers)
        .leftJoin(users, eq(notionUsers.userId, users.id))
        .where(and(...conditions));

      const itemCounts = await db
        .select({
          externalId: contentParticipants.externalId,
          count: count(),
        })
        .from(contentParticipants)
        .innerJoin(contentItems, eq(contentParticipants.contentItemId, contentItems.id))
        .where(eq(contentItems.sourceId, sourceId))
        .groupBy(contentParticipants.externalId);

      const countMap = new Map(itemCounts.map((ic) => [ic.externalId, ic.count]));

      return usersWithInfo.map((u) => ({
        externalId: u.externalId,
        name: u.name || 'Unknown',
        email: u.email,
        itemCount: countMap.get(u.externalId) || 0,
        linkedUserId: u.linkedUserId,
        linkedUserName: u.linkedUser?.name || null,
        linkedUserEmail: u.linkedUser?.email || null,
        linkedUserImage: u.linkedUser?.image || null,
        suggestions: [] as Suggestion[],
      }));
    },
    catch: (e) => new Error(`Failed to get Notion users: ${e}`),
  });
}

function getGitHubUsers(sourceId: string, linkedFilter: string | null) {
  return Effect.tryPromise({
    try: async () => {
      const conditions = [eq(githubUsers.sourceId, sourceId)];
      if (linkedFilter === 'true') {
        conditions.push(isNotNull(githubUsers.userId));
      } else if (linkedFilter === 'false') {
        conditions.push(isNull(githubUsers.userId));
      }

      const usersWithInfo = await db
        .select({
          externalId: githubUsers.githubLogin,
          name: githubUsers.name,
          email: githubUsers.email,
          linkedUserId: githubUsers.userId,
          linkedUser: {
            id: users.id,
            name: users.name,
            email: users.email,
            image: users.image,
          },
        })
        .from(githubUsers)
        .leftJoin(users, eq(githubUsers.userId, users.id))
        .where(and(...conditions));

      const itemCounts = await db
        .select({
          externalId: contentParticipants.externalId,
          count: count(),
        })
        .from(contentParticipants)
        .innerJoin(contentItems, eq(contentParticipants.contentItemId, contentItems.id))
        .where(eq(contentItems.sourceId, sourceId))
        .groupBy(contentParticipants.externalId);

      const countMap = new Map(itemCounts.map((ic) => [ic.externalId, ic.count]));

      return usersWithInfo.map((u) => ({
        externalId: u.externalId,
        name: u.name || u.externalId,
        email: u.email,
        itemCount: countMap.get(u.externalId) || 0,
        linkedUserId: u.linkedUserId,
        linkedUserName: u.linkedUser?.name || null,
        linkedUserEmail: u.linkedUser?.email || null,
        linkedUserImage: u.linkedUser?.image || null,
        suggestions: [] as Suggestion[],
      }));
    },
    catch: (e) => new Error(`Failed to get GitHub users: ${e}`),
  });
}
