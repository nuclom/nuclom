import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Redirect root to default workspace
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/vercel", request.url));
  }

  // Public routes that don't require authentication
  const publicRoutes = ["/login", "/register"];
  const isPublicRoute = publicRoutes.some(route => pathname.startsWith(route));

  // API routes are handled separately (better-auth handles its own auth)
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // For client-side authentication, we'll let the components handle auth state
  // This middleware primarily handles redirects and basic routing
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api|_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
