import { db } from '@nuclom/lib/db';
import { invitations, organizations, users } from '@nuclom/lib/db/schema';
import { logger } from '@nuclom/lib/logger';
import type { ApiResponse } from '@nuclom/lib/types';
import { eq } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

// =============================================================================
// GET /api/invitations/[id] - Get invitation details
// =============================================================================

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // First, check if invitation exists at all
    const rawInvitation = await db.select().from(invitations).where(eq(invitations.id, id)).limit(1);

    if (!rawInvitation[0]) {
      logger.warn(`[GET /api/invitations/${id}] Invitation not found in database`);
      const response: ApiResponse = {
        success: false,
        error: 'Invitation not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Check if organization exists
    const org = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, rawInvitation[0].organizationId))
      .limit(1);

    if (!org[0]) {
      logger.error(`[GET /api/invitations/${id}] Organization ${rawInvitation[0].organizationId} not found`);
      const response: ApiResponse = {
        success: false,
        error: 'Organization not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Check if inviter exists
    const inviter = await db.select().from(users).where(eq(users.id, rawInvitation[0].inviterId)).limit(1);

    if (!inviter[0]) {
      logger.error(`[GET /api/invitations/${id}] Inviter ${rawInvitation[0].inviterId} not found`);
      const response: ApiResponse = {
        success: false,
        error: 'Inviter not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    // Return full invitation data
    const response: ApiResponse = {
      success: true,
      data: {
        id: rawInvitation[0].id,
        email: rawInvitation[0].email,
        role: rawInvitation[0].role,
        status: rawInvitation[0].status,
        expiresAt: rawInvitation[0].expiresAt,
        organizationId: rawInvitation[0].organizationId,
        inviterId: rawInvitation[0].inviterId,
        organization: {
          id: org[0].id,
          name: org[0].name,
          slug: org[0].slug,
          logo: org[0].logo,
        },
        inviter: {
          id: inviter[0].id,
          name: inviter[0].name,
          image: inviter[0].image,
        },
      },
    };
    return NextResponse.json(response);
  } catch (error) {
    logger.error('[GET /api/invitations/[id]]', error instanceof Error ? error : new Error(String(error)));
    const response: ApiResponse = {
      success: false,
      error: 'Internal server error',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
