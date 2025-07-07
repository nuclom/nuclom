import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const invitation = req.nextUrl.searchParams.get("invitation");
  if (invitation === "ORG-INVITE-ABC123") {
    return NextResponse.json({
      valid: true,
      organization: {
        id: "invited-org-1",
        name: "Test Organization",
        slug: "test-org"
      },
      role: "member"
    });
  }
  return NextResponse.json({ valid: false }, { status: 400 });
}
