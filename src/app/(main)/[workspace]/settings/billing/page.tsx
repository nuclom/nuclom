"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, Users, Video } from "lucide-react";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["Up to 5 team members", "10 GB storage", "Basic video collaboration", "Community support"],
    limits: {
      members: 5,
      storage: "10 GB",
      videos: 50,
    },
  },
  {
    name: "Pro",
    price: "$19",
    period: "per month",
    features: [
      "Up to 25 team members",
      "100 GB storage",
      "Advanced video collaboration",
      "Priority support",
      "Custom branding",
      "Analytics dashboard",
    ],
    limits: {
      members: 25,
      storage: "100 GB",
      videos: 500,
    },
  },
  {
    name: "Enterprise",
    price: "$49",
    period: "per month",
    features: [
      "Unlimited team members",
      "1 TB storage",
      "Enterprise video collaboration",
      "24/7 dedicated support",
      "Custom integrations",
      "Advanced analytics",
      "Single sign-on (SSO)",
    ],
    limits: {
      members: "Unlimited",
      storage: "1 TB",
      videos: "Unlimited",
    },
  },
];

export default function BillingPage() {
  const params = useParams();
  const { toast } = useToast();
  const [currentPlan] = useState("Free");
  const [loading, setLoading] = useState(true);
  const [usage, setUsage] = useState({
    members: 0,
    storage: "0 GB",
    videos: 0,
  });

  useEffect(() => {
    loadBillingInfo();
  }, []);

  const loadBillingInfo = async () => {
    try {
      setLoading(true);
      // TODO: Implement actual billing API
      // For now, we'll simulate loading
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setUsage({
        members: 3,
        storage: "2.5 GB",
        videos: 12,
      });
    } catch (error) {
      console.error("Error loading billing info:", error);
      toast({
        title: "Error",
        description: "Failed to load billing information",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = (planName: string) => {
    // TODO: Implement actual billing/subscription logic
    toast({
      title: "Coming Soon",
      description: `Upgrade to ${planName} plan functionality is coming soon!`,
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Billing & Subscription</CardTitle>
            <CardDescription>Loading billing information...</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>You are currently on the {currentPlan} plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">{currentPlan}</h3>
              <p className="text-sm text-muted-foreground">
                {plans.find((p) => p.name === currentPlan)?.price} {plans.find((p) => p.name === currentPlan)?.period}
              </p>
            </div>
            <Badge variant="secondary">{currentPlan}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage</CardTitle>
          <CardDescription>Current usage for this organization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span>Team Members</span>
            </div>
            <span className="font-medium">{usage.members}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span>Storage Used</span>
            </div>
            <span className="font-medium">{usage.storage}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              <span>Videos</span>
            </div>
            <span className="font-medium">{usage.videos}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>Choose the plan that best fits your needs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative p-6 border rounded-lg ${
                  plan.name === currentPlan ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                {plan.name === currentPlan && (
                  <Badge className="absolute -top-2 left-4" variant="default">
                    Current
                  </Badge>
                )}

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">{plan.price}</span>
                      <span className="text-sm text-muted-foreground">{plan.period}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t">
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div>Members: {plan.limits.members}</div>
                      <div>Storage: {plan.limits.storage}</div>
                      <div>Videos: {plan.limits.videos}</div>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    variant={plan.name === currentPlan ? "outline" : "default"}
                    onClick={() => handleUpgrade(plan.name)}
                    disabled={plan.name === currentPlan}
                  >
                    {plan.name === currentPlan ? "Current Plan" : `Upgrade to ${plan.name}`}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
