import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createOrganization, getUserOrganizations } from "@/lib/api/organizations";

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
