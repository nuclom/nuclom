import { Effect } from "effect";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Slack, SlackLive } from "@/lib/effect/services/slack";
import { env } from "@/lib/env/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get("organizationId");

  if (!organizationId) {
    return new Response("Missing organizationId", { status: 400 });
  }

  // Verify the user is authenticated
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return redirect("/login");
  }

  // Create state with user and org info for callback
  const state = Buffer.from(
    JSON.stringify({
      userId: session.user.id,
      organizationId,
      timestamp: Date.now(),
    }),
  ).toString("base64url");

  // Store state in a cookie for verification
  const cookieStore = await cookies();
  cookieStore.set("slack_oauth_state", state, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  // Get authorization URL
  const effect = Effect.gen(function* () {
    const slack = yield* Slack;
    return yield* slack.getAuthorizationUrl(state);
  });

  const authUrl = await Effect.runPromise(Effect.provide(effect, SlackLive));

  return redirect(authUrl);
}
