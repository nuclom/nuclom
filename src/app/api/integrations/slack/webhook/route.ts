import { Effect, Layer } from "effect";
import { NextResponse } from "next/server";
import { Slack, SlackLive } from "@/lib/effect/services/slack";

export const dynamic = "force-dynamic";

interface SlackEventPayload {
  type: string;
  token?: string;
  challenge?: string;
  team_id?: string;
  event?: {
    type: string;
    user?: string;
    channel?: string;
    text?: string;
    ts?: string;
  };
}

export async function POST(request: Request) {
  const slackSignature = request.headers.get("x-slack-signature");
  const slackTimestamp = request.headers.get("x-slack-request-timestamp");
  const rawBody = await request.text();

  // Verify the request is from Slack
  if (!slackSignature || !slackTimestamp) {
    return NextResponse.json({ error: "Missing Slack signature" }, { status: 401 });
  }

  const effect = Effect.gen(function* () {
    const slack = yield* Slack;
    const isValid = yield* slack.verifySignature(slackSignature, slackTimestamp, rawBody);
    return isValid;
  });

  try {
    const isValid = await Effect.runPromise(Effect.provide(effect, SlackLive));

    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } catch (err) {
    console.error("[Slack Webhook Signature Error]", err);
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }

  // Parse the payload
  let payload: SlackEventPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Handle URL verification challenge
  if (payload.type === "url_verification" && payload.challenge) {
    return NextResponse.json({ challenge: payload.challenge });
  }

  // Handle event callbacks
  if (payload.type === "event_callback" && payload.event) {
    const event = payload.event;

    switch (event.type) {
      case "app_home_opened":
        // User opened the app home tab
        console.log("[Slack Event] App home opened by user:", event.user);
        break;

      case "message":
        // Handle direct messages to the bot
        console.log("[Slack Event] Message received:", event.text);
        break;

      case "app_mention":
        // Bot was mentioned in a channel
        console.log("[Slack Event] App mentioned:", event.text);
        break;

      default:
        console.log("[Slack Event] Unhandled event type:", event.type);
    }
  }

  return NextResponse.json({ ok: true });
}
