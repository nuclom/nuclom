"use client";

import { AlertTriangle, CheckCircle, CreditCard, Crown, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  cancelSubscription,
  listSubscriptions,
  openBillingPortal,
  restoreSubscription,
  type SubscriptionPlan,
  upgradeSubscription,
} from "@/lib/auth-client";
import { cn } from "@/lib/utils";

// Types for subscription data from Better Auth Stripe
interface SubscriptionData {
  id: string;
  plan: SubscriptionPlan;
  status: string;
  cancelAtPeriodEnd: boolean;
  periodStart: Date | null;
  periodEnd: Date | null;
  trialStart: Date | null;
  trialEnd: Date | null;
  seats: number | null;
}

// Helper to safely convert subscription response to our data type
function mapSubscriptionData(sub: {
  id: string;
  plan: string;
  status: string;
  cancelAtPeriodEnd?: boolean;
  periodStart?: Date | string | null;
  periodEnd?: Date | string | null;
  trialStart?: Date | string | null;
  trialEnd?: Date | string | null;
  seats?: number | null;
}): SubscriptionData {
  return {
    id: sub.id,
    plan: sub.plan as SubscriptionPlan,
    status: sub.status,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? false,
    periodStart: sub.periodStart ? new Date(sub.periodStart) : null,
    periodEnd: sub.periodEnd ? new Date(sub.periodEnd) : null,
    trialStart: sub.trialStart ? new Date(sub.trialStart) : null,
    trialEnd: sub.trialEnd ? new Date(sub.trialEnd) : null,
    seats: sub.seats ?? null,
  };
}

interface SubscriptionManagerProps {
  organizationId: string;
  organizationSlug: string;
  currentUserId: string;
  isOwner: boolean;
}

export function SubscriptionManager({
  organizationId,
  organizationSlug,
  currentUserId: _currentUserId,
  isOwner,
}: SubscriptionManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [_selectedPlan, _setSelectedPlan] = useState<{ plan: SubscriptionPlan; annual: boolean } | null>(null);

  // Fetch subscriptions on mount
  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const result = await listSubscriptions(organizationId);
        if (result.data) {
          setSubscriptions(result.data.map(mapSubscriptionData));
        }
      } catch (error) {
        console.error("Failed to fetch subscriptions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscriptions();
  }, [organizationId]);

  // Get active subscription
  const activeSubscription = subscriptions.find((sub) => sub.status === "active" || sub.status === "trialing");

  // Get current plan name (null if no active subscription / trial expired)
  const currentPlan: SubscriptionPlan | null = activeSubscription?.plan || null;
  const isTrialing = activeSubscription?.status === "trialing";
  const isCanceledAtPeriodEnd = activeSubscription?.cancelAtPeriodEnd;

  // Handle upgrade
  const handleUpgrade = async (plan: SubscriptionPlan, annual: boolean) => {
    if (!isOwner) {
      toast.error("Only organization owners can manage subscriptions");
      return;
    }

    startTransition(async () => {
      try {
        const baseUrl = window.location.origin;
        const result = await upgradeSubscription({
          plan,
          annual,
          referenceId: organizationId,
          successUrl: `${baseUrl}/${organizationSlug}/settings/billing?success=true`,
          cancelUrl: `${baseUrl}/${organizationSlug}/settings/billing?canceled=true`,
        });

        if (result.error) {
          toast.error(result.error.message || "Failed to start checkout");
          return;
        }

        // Better Auth Stripe redirects to checkout automatically
        if (result.data?.url) {
          window.location.href = result.data.url;
        }
      } catch (error) {
        console.error("Upgrade error:", error);
        toast.error("Failed to start checkout");
      }
    });
  };

  // Handle cancel
  const handleCancel = async () => {
    if (!activeSubscription || !isOwner) return;

    startTransition(async () => {
      try {
        const baseUrl = window.location.origin;
        const result = await cancelSubscription(
          activeSubscription.id,
          `${baseUrl}/${organizationSlug}/settings/billing`,
        );

        if (result.error) {
          toast.error(result.error.message || "Failed to cancel subscription");
          return;
        }

        toast.success("Subscription will be canceled at the end of the billing period");
        setCancelDialogOpen(false);
        router.refresh();
      } catch (error) {
        console.error("Cancel error:", error);
        toast.error("Failed to cancel subscription");
      }
    });
  };

  // Handle restore
  const handleRestore = async () => {
    if (!activeSubscription || !isOwner) return;

    startTransition(async () => {
      try {
        const result = await restoreSubscription(activeSubscription.id);

        if (result.error) {
          toast.error(result.error.message || "Failed to restore subscription");
          return;
        }

        toast.success("Subscription restored successfully");
        router.refresh();
      } catch (error) {
        console.error("Restore error:", error);
        toast.error("Failed to restore subscription");
      }
    });
  };

  // Handle open billing portal
  const handleOpenPortal = async () => {
    startTransition(async () => {
      try {
        const baseUrl = window.location.origin;
        const result = await openBillingPortal(`${baseUrl}/${organizationSlug}/settings/billing`);

        if (result.error) {
          toast.error(result.error.message || "Failed to open billing portal");
          return;
        }

        if (result.data?.url) {
          window.location.href = result.data.url;
        }
      } catch (error) {
        console.error("Portal error:", error);
        toast.error("Failed to open billing portal");
      }
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Subscription Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                Current Plan
              </CardTitle>
              <CardDescription>Your current subscription and billing status</CardDescription>
            </div>
            <Badge variant={!currentPlan ? "secondary" : "default"} className="capitalize">
              {currentPlan || "No Active Plan"}
              {isTrialing && " (Trial)"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeSubscription ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2">
                    {activeSubscription.status === "active" ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : activeSubscription.status === "trialing" ? (
                      <Sparkles className="h-4 w-4 text-blue-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="font-medium capitalize">{activeSubscription.status}</span>
                    {isCanceledAtPeriodEnd && (
                      <Badge variant="destructive" className="ml-2">
                        Canceling
                      </Badge>
                    )}
                  </div>
                </div>

                {activeSubscription.periodEnd && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {isCanceledAtPeriodEnd ? "Access until" : "Next billing date"}
                    </p>
                    <p className="font-medium">{activeSubscription.periodEnd.toLocaleDateString()}</p>
                  </div>
                )}

                {isTrialing && activeSubscription.trialEnd && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Trial ends</p>
                    <p className="font-medium">{activeSubscription.trialEnd.toLocaleDateString()}</p>
                  </div>
                )}

                {activeSubscription.seats && (
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Seats</p>
                    <p className="font-medium">{activeSubscription.seats}</p>
                  </div>
                )}
              </div>

              {isCanceledAtPeriodEnd && (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-600" />
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      Your subscription is scheduled to cancel on {activeSubscription.periodEnd?.toLocaleDateString()}.
                      <Button variant="link" className="h-auto p-0 pl-1" onClick={handleRestore} disabled={isPending}>
                        {isPending ? "Restoring..." : "Restore subscription"}
                      </Button>
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
              <p className="text-muted-foreground">You are on the free plan with limited features.</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between gap-2 border-t pt-6">
          {isOwner && activeSubscription && activeSubscription.status !== "canceled" && (
            <>
              <Button variant="outline" onClick={handleOpenPortal} disabled={isPending}>
                <CreditCard className="mr-2 h-4 w-4" />
                {isPending ? "Loading..." : "Manage Billing"}
              </Button>
              {!isCanceledAtPeriodEnd && (
                <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="text-red-600 hover:text-red-700">
                      Cancel Subscription
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Cancel Subscription</DialogTitle>
                      <DialogDescription>
                        Are you sure you want to cancel? Your subscription will remain active until{" "}
                        {activeSubscription.periodEnd?.toLocaleDateString()}.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                        Keep Subscription
                      </Button>
                      <Button variant="destructive" onClick={handleCancel} disabled={isPending}>
                        {isPending ? "Canceling..." : "Yes, Cancel"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </>
          )}
          {isOwner && currentPlan !== "pro" && (
            <Button onClick={() => setUpgradeDialogOpen(true)} disabled={isPending}>
              <Sparkles className="mr-2 h-4 w-4" />
              {!currentPlan ? "Start Subscription" : currentPlan === "scale" ? "Upgrade to Pro" : "Subscribe"}
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Upgrade Dialog */}
      <UpgradeDialog
        open={upgradeDialogOpen}
        onOpenChange={setUpgradeDialogOpen}
        currentPlan={currentPlan}
        onSelectPlan={(plan, annual) => {
          handleUpgrade(plan, annual);
          setUpgradeDialogOpen(false);
        }}
        isPending={isPending}
      />
    </div>
  );
}

// Upgrade Dialog Component
interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan: SubscriptionPlan | null;
  onSelectPlan: (plan: SubscriptionPlan, annual: boolean) => void;
  isPending: boolean;
}

function UpgradeDialog({ open, onOpenChange, currentPlan, onSelectPlan, isPending }: UpgradeDialogProps) {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");

  // Plan pricing synced with pricing.md
  const plans = [
    {
      name: "scale" as const,
      displayName: "Scale",
      monthlyPrice: 25,
      yearlyPrice: 228, // $19/month annual (24% off)
      features: [
        "5GB storage/user",
        "25 videos/user/mo",
        "25 team members",
        "60 min AI transcription/user",
        "Email support",
      ],
    },
    {
      name: "pro" as const,
      displayName: "Pro",
      monthlyPrice: 45,
      yearlyPrice: 468, // $39/month annual (13% off)
      features: [
        "25GB storage/user",
        "100 videos/user/mo",
        "Unlimited team members",
        "300 min AI transcription/user",
        "SSO/SAML + Custom branding",
        "Priority support + Dedicated manager",
      ],
    },
  ];

  const availablePlans = plans.filter((p) => {
    if (!currentPlan) return true; // Show all plans if no active subscription
    if (currentPlan === "scale") return p.name === "pro"; // Only show Pro for Scale users
    return false; // Pro users can't upgrade further within the app
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Upgrade Your Plan</DialogTitle>
          <DialogDescription>Choose the plan that best fits your needs</DialogDescription>
        </DialogHeader>

        {/* Billing Period Toggle */}
        <div className="flex justify-center gap-2 py-4">
          <Button
            variant={billingPeriod === "monthly" ? "default" : "outline"}
            size="sm"
            onClick={() => setBillingPeriod("monthly")}
          >
            Monthly
          </Button>
          <Button
            variant={billingPeriod === "yearly" ? "default" : "outline"}
            size="sm"
            onClick={() => setBillingPeriod("yearly")}
          >
            Yearly
            <Badge variant="secondary" className="ml-2">
              Save 24%
            </Badge>
          </Button>
        </div>

        {/* Plan Cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {availablePlans.map((plan) => (
            <Card key={plan.name} className={cn("relative", plan.name === "pro" && "border-primary")}>
              {plan.name === "pro" && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary">Most Popular</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.displayName}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold">
                    ${billingPeriod === "monthly" ? plan.monthlyPrice : Math.round(plan.yearlyPrice / 12)}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                  {billingPeriod === "yearly" && (
                    <span className="block text-sm text-muted-foreground">
                      Billed annually (${plan.yearlyPrice}/year)
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  onClick={() => onSelectPlan(plan.name, billingPeriod === "yearly")}
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>Upgrade to {plan.displayName}</>
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <DialogFooter>
          <p className="text-xs text-muted-foreground">14-day free trial. No credit card required. Cancel anytime.</p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
