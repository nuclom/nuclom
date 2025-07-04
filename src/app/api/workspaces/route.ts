import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workspaces, workspaceUsers, videos, channels, series } from "@/lib/db/schema";
import { eq, desc, count, inArray } from "drizzle-orm";
import type { ApiResponse, CreateWorkspaceData } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    let workspacesData: any[];
    if (userId) {
      // Get workspace IDs for the user first
      const userWorkspaces = await db.select({ workspaceId: workspaceUsers.workspaceId })
        .from(workspaceUsers)
        .where(eq(workspaceUsers.userId, userId));
      
      const workspaceIds = userWorkspaces.map(uw => uw.workspaceId);
      
      if (workspaceIds.length > 0) {
        workspacesData = await db.query.workspaces.findMany({
          where: inArray(workspaces.id, workspaceIds),
          with: {
            users: {
              with: {
                user: true,
              },
            },
          },
          orderBy: desc(workspaces.createdAt),
        });
      } else {
        workspacesData = [];
      }
    } else {
      workspacesData = await db.query.workspaces.findMany({
        with: {
          users: {
            with: {
              user: true,
            },
          },
        },
        orderBy: desc(workspaces.createdAt),
      });
    }

    // Get counts for each workspace
    const workspacesWithCounts = await Promise.all(
      workspacesData.map(async (workspace) => {
        const [videoCount, channelCount, seriesCount] = await Promise.all([
          db.select({ count: count() }).from(videos).where(eq(videos.workspaceId, workspace.id)),
          db.select({ count: count() }).from(channels).where(eq(channels.workspaceId, workspace.id)),
          db.select({ count: count() }).from(series).where(eq(series.workspaceId, workspace.id)),
        ]);

        return {
          ...workspace,
          _count: {
            videos: videoCount[0]?.count || 0,
            channels: channelCount[0]?.count || 0,
            series: seriesCount[0]?.count || 0,
          },
        };
      })
    );

    const response: ApiResponse = {
      success: true,
      data: workspacesWithCounts,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching workspaces:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch workspaces" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateWorkspaceData & { ownerId: string } =
      await request.json();

    const [insertedWorkspace] = await db.insert(workspaces).values({
      name: body.name,
      slug: body.slug,
      description: body.description,
    }).returning();

    await db.insert(workspaceUsers).values({
      userId: body.ownerId,
      workspaceId: insertedWorkspace.id,
      role: "OWNER",
    });

    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, insertedWorkspace.id),
      with: {
        users: {
          with: {
            user: true,
          },
        },
      },
    });

    const response: ApiResponse = {
      success: true,
      data: workspace,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Error creating workspace:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create workspace" },
      { status: 500 },
    );
  }
}
