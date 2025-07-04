import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { ApiResponse, CreateWorkspaceData } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    const where: any = {};
    if (userId) {
      where.users = {
        some: {
          userId: userId,
        },
      };
    }

    const workspaces = await prisma.workspace.findMany({
      where,
      include: {
        users: {
          include: {
            user: true,
          },
        },
        _count: {
          select: {
            videos: true,
            channels: true,
            series: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const response: ApiResponse = {
      success: true,
      data: workspaces,
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

    const workspace = await prisma.workspace.create({
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        users: {
          create: {
            userId: body.ownerId,
            role: "OWNER",
          },
        },
      },
      include: {
        users: {
          include: {
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
