import { Effect, Option } from 'effect';
import { createFullLayer } from '@/lib/api-handler';
import { BillingRepository } from '@/lib/effect/services/billing-repository';
import { TrialBanner } from './trial-banner';

interface TrialBannerWrapperProps {
  organizationId: string;
  organizationSlug: string;
}

export async function TrialBannerWrapper({ organizationId, organizationSlug }: TrialBannerWrapperProps) {
  // Fetch subscription status server-side
  const effect = Effect.gen(function* () {
    const billingRepo = yield* BillingRepository;
    return yield* billingRepo.getSubscriptionOption(organizationId);
  });

  const result = await Effect.runPromise(
    Effect.provide(effect, createFullLayer()).pipe(Effect.catchAll(() => Effect.succeed(Option.none()))),
  );

  // Only show banner for trial subscriptions
  if (Option.isNone(result)) {
    return null;
  }

  const subscription = result.value;

  // Only show for trialing status (including expired trials that haven't been updated yet)
  if (!subscription.trialEnd) {
    return null;
  }

  // Show for trialing status or any subscription with a trial end date
  if (subscription.status !== 'trialing' && subscription.status !== 'incomplete_expired') {
    return null;
  }

  return <TrialBanner trialEnd={new Date(subscription.trialEnd)} organizationSlug={organizationSlug} />;
}
