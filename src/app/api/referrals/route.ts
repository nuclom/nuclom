import { Cause, Effect, Exit, Layer } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppLive, MissingFieldError } from "@/lib/effect";
import { mapErrorToResponse } from "@/lib/effect/runtime";
import { Auth, makeAuthLayer } from "@/lib/effect/services/auth";
import {
  generateReferralCode,
  ReferralRepository,
  ReferralRepositoryLive,
} from "@/lib/effect/services/referral-repository";

// =============================================================================
// GET /api/referrals - Get user's referral codes and stats
// =============================================================================

export async function GET(request: NextRequest) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.mergeAll(AppLive, AuthLayer, ReferralRepositoryLive);

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const referralRepo = yield* ReferralRepository;

    // Get user's referral codes with stats
    const codes = yield* referralRepo.getUserReferralCodes(user.id);

    // Get user's referrals
    const referralList = yield* referralRepo.getUserReferrals(user.id);

    // Get stats
    const stats = yield* referralRepo.getReferralStats(user.id);

    // Get active program
    const programOption = yield* referralRepo.getActiveProgram();

    return {
      codes,
      referrals: referralList,
      stats,
      program: programOption._tag === "Some" ? programOption.value : null,
    };
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToResponse(error.value);
      }
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => NextResponse.json(data),
  });
}

// =============================================================================
// POST /api/referrals - Create a new referral code
// =============================================================================

export async function POST(request: NextRequest) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.mergeAll(AppLive, AuthLayer, ReferralRepositoryLive);

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse body (optional custom code)
    const body = yield* Effect.tryPromise({
      try: () => request.json().catch(() => ({})),
      catch: () => new MissingFieldError({ field: "body", message: "Invalid request body" }),
    });

    const referralRepo = yield* ReferralRepository;

    // Generate or use custom code
    const code = body.code?.toUpperCase() || generateReferralCode(user.name);

    // Create the referral code
    const referralCode = yield* referralRepo.createReferralCode({
      userId: user.id,
      code,
      maxUses: body.maxUses ?? null,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    });

    return {
      success: true,
      referralCode,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://nuclom.com"}/signup?ref=${referralCode.code}`,
    };
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        return mapErrorToResponse(error.value);
      }
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => NextResponse.json(data, { status: 201 }),
  });
}
