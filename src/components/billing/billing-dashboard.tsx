"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Invoice, Plan } from "@/lib/db/schema";
import type { OrganizationBillingInfo, UsageSummary } from "@/lib/effect/services/billing-repository";
import { InvoiceList } from "./invoice-list";
import { PlanSelector } from "./plan-selector";
import { SubscriptionCard } from "./subscription-card";
import { UsageChart, UsageOverview } from "./usage-chart";

interface BillingDashboardProps {
  organizationId: string;
  billingInfo: OrganizationBillingInfo;
  plans: Plan[];
  usageSummary: UsageSummary | null;
}

export function BillingDashboard({ organizationId, billingInfo, plans, usageSummary }: BillingDashboardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectPlan = async (planId: string, billingPeriod: "monthly" | "yearly") => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, planId, billingPeriod }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session");
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to start checkout");
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to open billing portal");
      }

      // Redirect to Stripe Customer Portal
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Portal error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to open billing portal");
    }
  };

  const handleCancelSubscription = async () => {
    try {
      const response = await fetch("/api/billing/subscription", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel subscription");
      }

      toast.success("Subscription will be canceled at the end of the billing period");
      router.refresh();
    } catch (error) {
      console.error("Cancel error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to cancel subscription");
    }
  };

  const handleResumeSubscription = async () => {
    try {
      const response = await fetch("/api/billing/subscription", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, action: "resume" }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to resume subscription");
      }

      toast.success("Subscription resumed successfully");
      router.refresh();
    } catch (error) {
      console.error("Resume error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to resume subscription");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Billing</h2>
        <p className="text-muted-foreground">Manage your subscription, view usage, and download invoices.</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <SubscriptionCard
            subscription={billingInfo.subscription}
            onManageBilling={handleManageBilling}
            onCancelSubscription={handleCancelSubscription}
            onResumeSubscription={handleResumeSubscription}
            isLoading={isLoading}
          />

          {usageSummary && (
            <>
              <UsageOverview usage={usageSummary} />
              <UsageChart usage={usageSummary} />
            </>
          )}
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          <PlanSelector
            plans={plans}
            currentPlanId={billingInfo.subscription?.planId}
            onSelectPlan={handleSelectPlan}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="invoices" className="space-y-6">
          <InvoiceList invoices={billingInfo.invoices} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
