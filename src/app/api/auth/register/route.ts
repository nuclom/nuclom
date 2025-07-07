import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  // Simulate rate limiting for a specific email
  const { email } = await req.json();
  if (email === "ratelimited@example.com") {
    return NextResponse.json({
      error: "Too many registration attempts. Please try again in 15 minutes.",
      retryAfter: 900
    }, { status: 429 });
  }
  // Simulate success for all other emails
  return NextResponse.json({
    success: true,
    user: {
      id: "new-user-1",
      name: "Test User",
      email,
      emailVerified: false
    }
  });
}
