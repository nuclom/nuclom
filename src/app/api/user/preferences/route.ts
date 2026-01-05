import { eq } from "drizzle-orm";
import { Schema } from "effect";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { safeParse } from "@/lib/validation";

const UpdatePreferencesSchema = Schema.Struct({
  emailNotifications: Schema.optional(Schema.Boolean),
  emailCommentReplies: Schema.optional(Schema.Boolean),
  emailMentions: Schema.optional(Schema.Boolean),
  emailVideoProcessing: Schema.optional(Schema.Boolean),
  emailWeeklyDigest: Schema.optional(Schema.Boolean),
  emailProductUpdates: Schema.optional(Schema.Boolean),
  pushNotifications: Schema.optional(Schema.Boolean),
  theme: Schema.optional(Schema.Literal("light", "dark", "system")),
  showActivityStatus: Schema.optional(Schema.Boolean),
});

// =============================================================================
// GET /api/user/preferences - Get user notification preferences
// =============================================================================

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user preferences or return defaults
    const preferences = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, session.user.id),
    });

    if (!preferences) {
      // Return defaults if no preferences exist
      return NextResponse.json({
        emailNotifications: true,
        emailCommentReplies: true,
        emailMentions: true,
        emailVideoProcessing: true,
        emailWeeklyDigest: false,
        emailProductUpdates: true,
        pushNotifications: true,
        theme: "system",
        showActivityStatus: true,
      });
    }

    return NextResponse.json(preferences);
  } catch (error) {
    console.error("Error fetching user preferences:", error);
    return NextResponse.json({ error: "Failed to fetch preferences" }, { status: 500 });
  }
}

// =============================================================================
// PUT /api/user/preferences - Update user notification preferences
// =============================================================================

export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.json();
    const result = safeParse(UpdatePreferencesSchema, rawBody);
    if (!result.success) {
      return NextResponse.json({ error: "Invalid request format" }, { status: 400 });
    }
    const {
      emailNotifications,
      emailCommentReplies,
      emailMentions,
      emailVideoProcessing,
      emailWeeklyDigest,
      emailProductUpdates,
      pushNotifications,
      theme,
      showActivityStatus,
    } = result.data;

    // Check if preferences exist
    const existing = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, session.user.id),
    });

    const updateData = {
      emailNotifications: emailNotifications ?? true,
      emailCommentReplies: emailCommentReplies ?? true,
      emailMentions: emailMentions ?? true,
      emailVideoProcessing: emailVideoProcessing ?? true,
      emailWeeklyDigest: emailWeeklyDigest ?? false,
      emailProductUpdates: emailProductUpdates ?? true,
      pushNotifications: pushNotifications ?? true,
      theme: theme ?? "system",
      showActivityStatus: showActivityStatus ?? true,
      updatedAt: new Date(),
    };

    if (existing) {
      // Update existing preferences
      await db.update(userPreferences).set(updateData).where(eq(userPreferences.userId, session.user.id));
    } else {
      // Create new preferences
      await db.insert(userPreferences).values({
        userId: session.user.id,
        ...updateData,
        createdAt: new Date(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating user preferences:", error);
    return NextResponse.json({ error: "Failed to update preferences" }, { status: 500 });
  }
}
