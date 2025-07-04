import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Redirects the root path to a default workspace
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/vercel", request.url));
  }
}

export const config = {
  matcher: "/",
};
