'use client';

import type { Plan, PlanFeatures } from '@nuclom/lib/db/schema';
import { cn } from '@nuclom/lib/utils';
import { Check, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface PlanSelectorProps {
  plans: Plan[];
  currentPlanId?: string;
  onSelectPlan: (planId: string, billingPeriod: 'monthly' | 'yearly') => Promise<void>;
  isLoading?: boolean;
}

const formatBytes = (bytes: number): string => {
  if (bytes === -1) return 'Unlimited';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(0)} GB`;
};

const formatLimit = (value: number): string => {
  if (value === -1) return 'Unlimited';
  return value.toString();
};

const formatPrice = (cents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
};

const featureLabels: Record<keyof PlanFeatures, string> = {
  aiInsights: 'AI Video Insights',
  customBranding: 'Custom Branding',
  sso: 'SSO Authentication',
  prioritySupport: 'Priority Support',
  apiAccess: 'API Access',
};

export function PlanSelector({ plans, currentPlanId, onSelectPlan, isLoading }: PlanSelectorProps) {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  const handleSelectPlan = async (planId: string) => {
    if (planId === currentPlanId) return;

    setLoadingPlanId(planId);
    try {
      await onSelectPlan(planId, billingPeriod);
    } finally {
      setLoadingPlanId(null);
    }
  };

  const yearlySavings = (plan: Plan): number => {
    if (!plan.priceYearly || plan.priceMonthly === 0) return 0;
    const monthlyTotal = plan.priceMonthly * 12;
    return Math.round(((monthlyTotal - plan.priceYearly) / monthlyTotal) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center gap-4">
        <Label htmlFor="billing-toggle" className={cn(billingPeriod === 'monthly' && 'text-foreground font-medium')}>
          Monthly
        </Label>
        <Switch
          id="billing-toggle"
          checked={billingPeriod === 'yearly'}
          onCheckedChange={(checked) => setBillingPeriod(checked ? 'yearly' : 'monthly')}
        />
        <Label htmlFor="billing-toggle" className={cn(billingPeriod === 'yearly' && 'text-foreground font-medium')}>
          Yearly
          <Badge variant="secondary" className="ml-2">
            Save 24%
          </Badge>
        </Label>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrentPlan = plan.id === currentPlanId;
          const price = billingPeriod === 'yearly' && plan.priceYearly ? plan.priceYearly / 12 : plan.priceMonthly;
          const savings = yearlySavings(plan);
          const isPlanLoading = loadingPlanId === plan.id;

          return (
            <Card
              key={plan.id}
              className={cn(
                'relative flex flex-col',
                isCurrentPlan && 'border-primary ring-2 ring-primary ring-offset-2',
                (plan.id === 'pro' || plan.name.toLowerCase() === 'pro') && 'border-primary/50',
              )}
            >
              {isCurrentPlan && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Current Plan</Badge>}
              {(plan.id === 'pro' || plan.name.toLowerCase() === 'pro') && !isCurrentPlan && (
                <Badge variant="secondary" className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most Popular
                </Badge>
              )}

              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 space-y-4">
                <div className="space-y-1">
                  <span className="text-3xl font-bold">{formatPrice(price)}</span>
                  <span className="text-muted-foreground">/month</span>
                  {billingPeriod === 'yearly' && savings > 0 && (
                    <Badge variant="outline" className="ml-2">
                      Save {savings}%
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Limits:</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {formatBytes(plan.limits.storage)} storage
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {formatLimit(plan.limits.videos)} videos
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {formatLimit(plan.limits.members)} team members
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary" />
                      {formatBytes(plan.limits.bandwidth)}/month bandwidth
                    </li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Features:</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {Object.entries(plan.features).map(([key, enabled]) => (
                      <li
                        key={key}
                        className={cn('flex items-center gap-2', !enabled && 'text-muted-foreground/50 line-through')}
                      >
                        <Check className={cn('h-4 w-4', enabled ? 'text-primary' : 'text-muted-foreground/50')} />
                        {featureLabels[key as keyof PlanFeatures]}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={
                    isCurrentPlan
                      ? 'outline'
                      : plan.id === 'pro' || plan.name.toLowerCase() === 'pro'
                        ? 'default'
                        : 'secondary'
                  }
                  disabled={isCurrentPlan || isLoading || isPlanLoading}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  {isPlanLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
