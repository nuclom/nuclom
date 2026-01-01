import { Cause, Effect, Exit, Layer } from "effect";
import { type NextRequest, NextResponse } from "next/server";
import { AppLive } from "@/lib/effect";
import { mapErrorToResponse } from "@/lib/effect/runtime";
import {
  ReferralCodeExpiredError,
  ReferralCodeMaxUsesError,
  ReferralCodeNotFoundError,
  ReferralRepository,
  ReferralRepositoryLive,
} from "@/lib/effect/services/referral-repository";

// =============================================================================
// GET /api/referrals/code/[code] - Validate a referral code
// =============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const FullLayer = Layer.merge(AppLive, ReferralRepositoryLive);

  const effect = Effect.gen(function* () {
    const referralRepo = yield* ReferralRepository;

    // Validate the code (this will throw if invalid/expired/max uses)
    const referralCode = yield* referralRepo.getReferralCodeByCode(code);

    return {
      valid: true,
      code: referralCode.code,
      message: "Referral code is valid",
    };
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
        const err = error.value;

        if (err instanceof ReferralCodeNotFoundError) {
          return NextResponse.json(
            { valid: false, error: "Referral code not found" },
            { status: 404 },
          );
        }

        if (err instanceof ReferralCodeExpiredError) {
          return NextResponse.json(
            { valid: false, error: "Referral code has expired" },
            { status: 410 },
          );
        }

        if (err instanceof ReferralCodeMaxUsesError) {
          return NextResponse.json(
            { valid: false, error: "Referral code has reached maximum uses" },
            { status: 410 },
          );
        }

        return mapErrorToResponse(err);
      }
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    },
    onSuccess: (data) => NextResponse.json(data),
  });
}
