import { auth } from '@nuclom/lib/auth';
import { AppLive } from '@nuclom/lib/effect';
import { Auth, makeAuthLayer } from '@nuclom/lib/effect/services/auth';
import { Billing } from '@nuclom/lib/effect/services/billing';
import { BillingRepository } from '@nuclom/lib/effect/services/billing-repository';
import { OrganizationRepository } from '@nuclom/lib/effect/services/organization-repository';
import { Effect, Exit, Layer, Option } from 'effect';
import { Loader2 } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { BillingDashboard } from '@/components/billing/billing-dashboard';

interface BillingPageProps {
  params: Promise<{ organization: string }>;
  searchParams: Promise<{ success?: string; canceled?: string }>;
}

function BillingSkeleton() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

async function getBillingData(organizationSlug: string) {
  const AuthLayer = makeAuthLayer(auth);
  const FullLayer = Layer.merge(AppLive, AuthLayer);
  const headersList = await headers();

  const effect = Effect.gen(function* () {
    // Authenticate
    const authService = yield* Auth;
    const { user } = yield* authService.getSession(headersList);

    // Get organization by slug
    const orgRepo = yield* OrganizationRepository;
    const org = yield* orgRepo.getOrganizationBySlug(organizationSlug);

    // Verify user is member of organization
    yield* orgRepo.isMember(user.id, org.id);

    // Get user's role in organization
    const roleOption = yield* orgRepo.getUserRole(user.id, org.id);
    const isOwner = Option.isSome(roleOption) && roleOption.value === 'owner';

    // Get billing info
    const billingRepo = yield* BillingRepository;
    const billingInfo = yield* billingRepo.getBillingInfo(org.id);

    // Get all plans
    const billing = yield* Billing;
    const plans = yield* billing.getPlans();

    // Get usage summary if subscription exists
    let usageSummary = null;
    if (billingInfo.subscription) {
      const summary = yield* billing.getUsageSummary(org.id).pipe(Effect.option);
      usageSummary = Option.getOrNull(summary);
    }

    return {
      organizationId: org.id,
      organizationSlug: org.slug ?? org.id,
      currentUserId: user.id,
      isOwner,
      billingInfo,
      plans,
      usageSummary,
    };
  });

  const runnable = Effect.provide(effect, FullLayer);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: () => null,
    onSuccess: (data) => data,
  });
}

async function BillingContent({ params, searchParams }: BillingPageProps) {
  const { organization } = await params;
  const { success, canceled } = await searchParams;

  const data = await getBillingData(organization);

  if (!data) {
    redirect(`/org/${organization}/settings/profile`);
  }

  return (
    <div className="space-y-6">
      {success === 'true' && (
        <div className="rounded-lg bg-green-50 p-4 text-green-800 dark:bg-green-950 dark:text-green-200">
          <p className="font-medium">Subscription activated successfully!</p>
          <p className="text-sm">Thank you for upgrading. Your new plan is now active.</p>
        </div>
      )}

      {canceled === 'true' && (
        <div className="rounded-lg bg-yellow-50 p-4 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
          <p className="font-medium">Checkout was canceled</p>
          <p className="text-sm">No charges were made. Feel free to try again when you're ready.</p>
        </div>
      )}

      <BillingDashboard
        organizationId={data.organizationId}
        organizationSlug={data.organizationSlug}
        currentUserId={data.currentUserId}
        isOwner={data.isOwner}
        billingInfo={data.billingInfo}
        plans={data.plans}
        usageSummary={data.usageSummary}
      />
    </div>
  );
}

export default function BillingPage({ params, searchParams }: BillingPageProps) {
  return (
    <Suspense fallback={<BillingSkeleton />}>
      <BillingContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}
