import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createOrganization,
  getUserOrganizations,
  updateOrganization,
  deleteOrganization,
} from "@/lib/api/organizations";
import { requirePermission } from "@/lib/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organizations = await getUserOrganizations(session.user.id);

    return NextResponse.json(organizations);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, slug, logo } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 });
    }

    const organization = await createOrganization({
      name,
      slug,
      logo,
      userId: session.user.id,
    });

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Error creating organization:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, name, slug, logo } = body;

    if (!id || !name || !slug) {
      return NextResponse.json({ error: "ID, name and slug are required" }, { status: 400 });
    }

    await requirePermission(session.user.id, id, "organization:write");

    const organization = await updateOrganization(id, { name, slug, logo });

    return NextResponse.json(organization);
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    await requirePermission(session.user.id, id, "organization:delete");

    await deleteOrganization(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting organization:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    );
  }
}
