import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { type ConsentAction, consentAuditLog, users } from "@/lib/db/schema";

// Grace period for account deletion in days
const DELETION_GRACE_PERIOD_DAYS = 30;

// GET /api/users/me - Get current user data
export async function GET(_request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [userData] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        emailVerified: users.emailVerified,
        image: users.image,
        role: users.role,
        createdAt: users.createdAt,
        marketingConsent: users.marketingConsent,
        marketingConsentAt: users.marketingConsentAt,
        deletionRequestedAt: users.deletionRequestedAt,
        deletionScheduledFor: users.deletionScheduledFor,
        warnedAt: users.warnedAt,
        warningReason: users.warningReason,
        suspendedUntil: users.suspendedUntil,
        suspensionReason: users.suspensionReason,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(userData);
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json({ error: "Failed to get user data" }, { status: 500 });
  }
}

// PATCH /api/users/me - Update user settings (marketing consent, etc.)
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const userId = session.user.id;

    // Handle marketing consent update
    if (typeof body.marketingConsent === "boolean") {
      const previousUser = await db
        .select({ marketingConsent: users.marketingConsent })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const previousValue = previousUser[0]?.marketingConsent ?? false;

      await db
        .update(users)
        .set({
          marketingConsent: body.marketingConsent,
          marketingConsentAt: body.marketingConsent ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Log the consent change
      await db.insert(consentAuditLog).values({
        userId,
        action: (body.marketingConsent ? "granted" : "withdrawn") as ConsentAction,
        details: {
          consentType: "marketing",
          previousValue,
          newValue: body.marketingConsent,
        },
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

// DELETE /api/users/me - Request account deletion (soft delete with grace period)
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Check if deletion is already requested
    const [userData] = await db
      .select({
        deletionRequestedAt: users.deletionRequestedAt,
        deletionScheduledFor: users.deletionScheduledFor,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userData?.deletionRequestedAt) {
      return NextResponse.json({
        message: "Account deletion already requested",
        deletionRequestedAt: userData.deletionRequestedAt,
        deletionScheduledFor: userData.deletionScheduledFor,
      });
    }

    // Calculate deletion date
    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + DELETION_GRACE_PERIOD_DAYS);

    // Mark account for deletion
    await db
      .update(users)
      .set({
        deletionRequestedAt: new Date(),
        deletionScheduledFor: deletionDate,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Log the deletion request
    await db.insert(consentAuditLog).values({
      userId,
      action: "withdrawn" as ConsentAction,
      details: {
        consentType: "account",
      },
      ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    });

    return NextResponse.json({
      success: true,
      message: `Account deletion scheduled. Your account will be permanently deleted on ${deletionDate.toLocaleDateString()}. You can cancel this request within the grace period.`,
      deletionRequestedAt: new Date().toISOString(),
      deletionScheduledFor: deletionDate.toISOString(),
      gracePeriodDays: DELETION_GRACE_PERIOD_DAYS,
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ error: "Failed to request account deletion" }, { status: 500 });
  }
}

// POST /api/users/me - Cancel account deletion
export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const userId = session.user.id;

    // Handle cancel deletion request
    if (body.action === "cancel_deletion") {
      const [userData] = await db
        .select({
          deletionRequestedAt: users.deletionRequestedAt,
          deletionScheduledFor: users.deletionScheduledFor,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!userData?.deletionRequestedAt) {
        return NextResponse.json({ error: "No deletion request found" }, { status: 400 });
      }

      // Check if still within grace period
      if (userData.deletionScheduledFor && userData.deletionScheduledFor < new Date()) {
        return NextResponse.json(
          { error: "Grace period has expired. Account deletion cannot be cancelled." },
          { status: 400 },
        );
      }

      // Cancel the deletion
      await db
        .update(users)
        .set({
          deletionRequestedAt: null,
          deletionScheduledFor: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      // Log the cancellation
      await db.insert(consentAuditLog).values({
        userId,
        action: "updated" as ConsentAction,
        details: {
          consentType: "account",
        },
        ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip"),
        userAgent: request.headers.get("user-agent"),
      });

      return NextResponse.json({
        success: true,
        message: "Account deletion cancelled successfully.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Post user error:", error);
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 });
  }
}
