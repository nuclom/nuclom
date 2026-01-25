'use client';

import { openBillingPortal } from '@nuclom/auth/client';
import { logger } from '@nuclom/lib/client-logger';
import type { PaymentMethod } from '@nuclom/lib/db/schema';
import { Badge } from '@nuclom/ui/badge';
import { Button } from '@nuclom/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nuclom/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@nuclom/ui/dropdown-menu';
import { CreditCard, MoreVertical, Plus, Star, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';

// Credit card brand icons mapping
const cardBrandIcons: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  jcb: 'JCB',
  diners: 'Diners Club',
  unionpay: 'UnionPay',
};

interface PaymentMethodListProps {
  paymentMethods: PaymentMethod[];
  organizationId: string;
  organizationSlug: string;
  isOwner: boolean;
}

export function PaymentMethodList({
  paymentMethods,
  organizationId,
  organizationSlug,
  isOwner,
}: PaymentMethodListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleAddPaymentMethod = async () => {
    startTransition(async () => {
      try {
        const baseUrl = window.location.origin;
        const result = await openBillingPortal(`${baseUrl}/${organizationSlug}/settings/billing`);

        if (result.error) {
          toast.error(result.error.message || 'Failed to open billing portal');
          return;
        }

        if (result.data?.url) {
          window.location.href = result.data.url;
        }
      } catch (error) {
        logger.error('Error opening billing portal', error);
        toast.error('Failed to open billing portal');
      }
    });
  };

  const handleSetDefault = async (paymentMethodId: string) => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/billing/payment-methods/${paymentMethodId}/default`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to set default payment method');
        }

        toast.success('Default payment method updated');
        router.refresh();
      } catch (error) {
        logger.error('Error setting default payment method', error);
        toast.error(error instanceof Error ? error.message : 'Failed to set default payment method');
      }
    });
  };

  const handleRemove = async (paymentMethodId: string) => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/billing/payment-methods/${paymentMethodId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to remove payment method');
        }

        toast.success('Payment method removed');
        router.refresh();
      } catch (error) {
        logger.error('Error removing payment method', error);
        toast.error(error instanceof Error ? error.message : 'Failed to remove payment method');
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Payment Methods
            </CardTitle>
            <CardDescription>Manage your payment methods for subscription billing</CardDescription>
          </div>
          {isOwner && (
            <Button onClick={handleAddPaymentMethod} disabled={isPending}>
              <Plus className="mr-2 h-4 w-4" />
              {isPending ? 'Loading...' : 'Manage Payment'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {paymentMethods.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <CreditCard className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No payment methods on file</p>
            {isOwner && (
              <Button variant="link" onClick={handleAddPaymentMethod} disabled={isPending}>
                Add a payment method
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {paymentMethods.map((pm) => (
              <div key={pm.id} className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {cardBrandIcons[pm.brand ?? ''] || pm.brand || 'Card'} **** {pm.last4}
                      </span>
                      {pm.isDefault && (
                        <Badge variant="secondary">
                          <Star className="mr-1 h-3 w-3" />
                          Default
                        </Badge>
                      )}
                    </div>
                    {pm.expMonth && pm.expYear && (
                      <p className="text-sm text-muted-foreground">
                        Expires {pm.expMonth}/{pm.expYear}
                      </p>
                    )}
                  </div>
                </div>

                {isOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={isPending}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!pm.isDefault && (
                        <DropdownMenuItem onClick={() => handleSetDefault(pm.stripePaymentMethodId)}>
                          <Star className="mr-2 h-4 w-4" />
                          Set as default
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => handleRemove(pm.stripePaymentMethodId)}
                        disabled={pm.isDefault}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
