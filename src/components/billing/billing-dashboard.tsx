"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Plan } from "@/lib/db/schema";
import type { OrganizationBillingInfo, UsageSummary } from "@/lib/effect/services/billing-repository";
import { InvoiceList } from "./invoice-list";
import { PaymentMethodList } from "./payment-method-list";
import { SubscriptionManager } from "./subscription-manager";
import { UsageChart, UsageOverview } from "./usage-chart";

interface BillingDashboardProps {
  organizationId: string;
  organizationSlug: string;
  billingInfo: OrganizationBillingInfo;
  plans: Plan[];
  usageSummary: UsageSummary | null;
  currentUserId: string;
  isOwner: boolean;
}

export function BillingDashboard({
  organizationId,
  organizationSlug,
  billingInfo,
  plans,
  usageSummary,
  currentUserId,
  isOwner,
}: BillingDashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState("subscription");

  // Handle success/cancel query params from Stripe checkout
  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");

    if (success === "true") {
      toast.success("Subscription activated successfully!");
      // Remove query params
      router.replace(`/${organizationSlug}/settings/billing`);
    } else if (canceled === "true") {
      toast.info("Checkout was canceled");
      router.replace(`/${organizationSlug}/settings/billing`);
    }
  }, [searchParams, router, organizationSlug]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Billing</h2>
        <p className="text-muted-foreground">Manage your subscription, view usage, and download invoices.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
        </TabsList>

        <TabsContent value="subscription" className="space-y-6">
          {/* Better Auth Stripe Subscription Manager */}
          <SubscriptionManager
            organizationId={organizationId}
            organizationSlug={organizationSlug}
            currentUserId={currentUserId}
            isOwner={isOwner}
          />
        </TabsContent>

        <TabsContent value="usage" className="space-y-6">
          {usageSummary ? (
            <>
              <UsageOverview usage={usageSummary} />
              <UsageChart usage={usageSummary} />
            </>
          ) : (
            <div className="rounded-lg border p-6 text-center text-muted-foreground">No usage data available yet</div>
          )}
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          <InvoiceList invoices={billingInfo.invoices} />
        </TabsContent>

        <TabsContent value="payment" className="space-y-6">
          <PaymentMethodList
            paymentMethods={billingInfo.paymentMethods}
            organizationId={organizationId}
            organizationSlug={organizationSlug}
            isOwner={isOwner}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
