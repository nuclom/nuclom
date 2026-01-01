import { Cause, Effect, Exit, Layer } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { AppLive, MissingFieldError } from "@/lib/effect";
import { mapErrorToResponse } from "@/lib/effect/runtime";
import { Auth, makeAuthLayer } from "@/lib/effect/services/auth";
import { ReferralRepository, ReferralRepositoryLive } from "@/lib/effect/services/referral-repository";

// =============================================================================
// GET /api/referrals/rewards - Get user's rewards
// =============================================================================

export async function GET(request: NextRequest) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.mergeAll(AppLive, AuthLayer, ReferralRepositoryLive);

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    const referralRepo = yield* ReferralRepository;

    // Get query params
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";

    // Get rewards based on filter
    const rewards = filter === "pending"
      ? yield* referralRepo.getPendingRewards(user.id)
      : yield* referralRepo.getUserRewards(user.id);

    // Calculate totals
    const totalEarned = rewards
      .filter((r) => r.status === "awarded" || r.status === "claimed")
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    const pendingAmount = rewards
      .filter((r) => r.status === "pending")
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    const claimableAmount = rewards
      .filter((r) => r.status === "awarded")
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    return {
      rewards,
      summary: {
        totalEarned,
        pendingAmount,
        claimableAmount,
        totalRewards: rewards.length,
      },
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
// POST /api/referrals/rewards - Claim a reward
// =============================================================================

export async function POST(request: NextRequest) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.mergeAll(AppLive, AuthLayer, ReferralRepositoryLive);

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(request.headers);

    // Parse body
    const body = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () => new MissingFieldError({ field: "body", message: "Invalid request body" }),
    });

    const { rewardId } = body;

    if (!rewardId) {
      return yield* Effect.fail(
        new MissingFieldError({ field: "rewardId", message: "Reward ID is required" }),
      );
    }

    const referralRepo = yield* ReferralRepository;

    // Claim the reward
    const reward = yield* referralRepo.claimReward(rewardId, user.id);

    return {
      success: true,
      reward,
      message: "Reward claimed successfully",
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
