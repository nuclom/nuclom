"use client";

import { format } from "date-fns";
import { AlertTriangle, Calendar, CreditCard, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { SubscriptionWithPlan } from "@/lib/effect/services/billing-repository";

interface SubscriptionCardProps {
  subscription: SubscriptionWithPlan | null;
  onManageBilling: () => Promise<void>;
  onCancelSubscription: () => Promise<void>;
  onResumeSubscription: () => Promise<void>;
  isLoading?: boolean;
}

const formatPrice = (cents: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
};

const getStatusBadge = (status: string, cancelAtPeriodEnd: boolean) => {
  if (cancelAtPeriodEnd) {
    return <Badge variant="destructive">Canceling</Badge>;
  }

  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
    active: { variant: "default", label: "Active" },
    trialing: { variant: "secondary", label: "Trial" },
    past_due: { variant: "destructive", label: "Past Due" },
    canceled: { variant: "outline", label: "Canceled" },
    incomplete: { variant: "outline", label: "Incomplete" },
    unpaid: { variant: "destructive", label: "Unpaid" },
  };

  const config = variants[status] || { variant: "outline" as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
};

// Plan display names and prices (synced with pricing.md)
const PLAN_DISPLAY_INFO: Record<string, { displayName: string; monthlyPrice: number }> = {
  free: { displayName: "Free", monthlyPrice: 0 },
  scale: { displayName: "Scale", monthlyPrice: 2500 }, // $25.00/user/month
  pro: { displayName: "Pro", monthlyPrice: 4500 }, // $45.00/user/month
  enterprise: { displayName: "Enterprise", monthlyPrice: 0 }, // Custom pricing
};

export function SubscriptionCard({
  subscription,
  onManageBilling,
  onCancelSubscription,
  onResumeSubscription,
  isLoading,
}: SubscriptionCardProps) {
  const [isManaging, setIsManaging] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  const handleManageBilling = async () => {
    setIsManaging(true);
    try {
      await onManageBilling();
    } finally {
      setIsManaging(false);
    }
  };

  const handleCancelSubscription = async () => {
    setIsCanceling(true);
    try {
      await onCancelSubscription();
    } finally {
      setIsCanceling(false);
    }
  };

  const handleResumeSubscription = async () => {
    setIsResuming(true);
    try {
      await onResumeSubscription();
    } finally {
      setIsResuming(false);
    }
  };

  if (!subscription) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>You are currently on the free plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">Free</p>
              <p className="text-sm text-muted-foreground">Basic features with limited storage</p>
            </div>
            <Badge variant="secondary">Free Tier</Badge>
          </div>
        </CardContent>
        <CardFooter>
          <p className="text-sm text-muted-foreground">Upgrade to a paid plan to unlock more features and storage.</p>
        </CardFooter>
      </Card>
    );
  }

  const isPastDue = subscription.status === "past_due";
  const isCanceled = subscription.cancelAtPeriodEnd;
  const isTrialing = subscription.status === "trialing";

  // Get plan display info - use local plan info if available, otherwise fall back to plan name
  const planName = subscription.plan;
  const planDisplayInfo = PLAN_DISPLAY_INFO[planName] || { displayName: planName, monthlyPrice: 0 };
  const displayName = subscription.planInfo?.name || planDisplayInfo.displayName;
  const monthlyPrice = subscription.planInfo?.priceMonthly ?? planDisplayInfo.monthlyPrice;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>Your subscription details</CardDescription>
          </div>
          {getStatusBadge(subscription.status ?? "active", subscription.cancelAtPeriodEnd ?? false)}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPastDue && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Payment Failed</AlertTitle>
            <AlertDescription>
              Your last payment failed. Please update your payment method to avoid service interruption.
            </AlertDescription>
          </Alert>
        )}

        {isCanceled && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Subscription Canceling</AlertTitle>
            <AlertDescription>
              Your subscription will be canceled at the end of the current billing period on{" "}
              {subscription.periodEnd
                ? format(new Date(subscription.periodEnd), "MMMM d, yyyy")
                : "the end of this period"}
              .
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Plan</p>
            <p className="text-2xl font-bold capitalize">{displayName}</p>
            {monthlyPrice > 0 && <p className="text-lg text-muted-foreground">{formatPrice(monthlyPrice)}/month</p>}
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {isTrialing ? "Trial Ends" : "Next Billing Date"}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <p className="text-lg">
                {isTrialing && subscription.trialEnd
                  ? format(new Date(subscription.trialEnd), "MMMM d, yyyy")
                  : subscription.periodEnd
                    ? format(new Date(subscription.periodEnd), "MMMM d, yyyy")
                    : "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-4">
          <Button variant="outline" onClick={handleManageBilling} disabled={isManaging || isLoading}>
            {isManaging ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
            Manage Billing
          </Button>

          {isCanceled ? (
            <Button variant="outline" onClick={handleResumeSubscription} disabled={isResuming || isLoading}>
              {isResuming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Resume Subscription
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive hover:text-destructive">
                  Cancel Subscription
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel your subscription? You will retain access until the end of your
                    current billing period on{" "}
                    {subscription.periodEnd
                      ? format(new Date(subscription.periodEnd), "MMMM d, yyyy")
                      : "the end of this period"}
                    .
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancelSubscription}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isCanceling}
                  >
                    {isCanceling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Cancel Subscription
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
