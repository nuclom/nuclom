/**
 * Stripe Service Tests
 *
 * Tests the Stripe service interface structure and error handling.
 * Full integration testing with Stripe would require the actual Stripe SDK.
 */

import { Effect, Exit, Layer } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { StripeApiError, WebhookSignatureError } from '../errors';
import { type StripeService, StripeServiceTag } from './stripe';

describe('Stripe Service', () => {
  // Create a mock Stripe service for testing
  const createMockStripeService = (): StripeService => ({
    client: {} as unknown as import('stripe').default,

    createCustomer: vi.fn().mockImplementation(({ email, name }) =>
      Effect.succeed({
        id: 'cus_test123',
        email,
        name,
        object: 'customer' as const,
        created: Date.now(),
        livemode: false,
      }),
    ),

    getCustomer: vi.fn().mockImplementation((customerId) =>
      Effect.succeed({
        id: customerId,
        email: 'test@example.com',
        object: 'customer' as const,
        created: Date.now(),
        livemode: false,
      }),
    ),

    createCheckoutSession: vi.fn().mockImplementation(() =>
      Effect.succeed({
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/pay/cs_test123',
        object: 'checkout.session' as const,
      }),
    ),

    createPortalSession: vi.fn().mockImplementation(() =>
      Effect.succeed({
        id: 'bps_test123',
        url: 'https://billing.stripe.com/session/bps_test123',
        object: 'billing_portal.session' as const,
      }),
    ),

    getSubscription: vi.fn().mockImplementation((subscriptionId) =>
      Effect.succeed({
        id: subscriptionId,
        status: 'active',
        object: 'subscription' as const,
      }),
    ),

    updateSubscription: vi.fn().mockImplementation((subscriptionId) =>
      Effect.succeed({
        id: subscriptionId,
        status: 'active',
        object: 'subscription' as const,
      }),
    ),

    cancelSubscriptionAtPeriodEnd: vi.fn().mockImplementation((subscriptionId) =>
      Effect.succeed({
        id: subscriptionId,
        status: 'active',
        cancel_at_period_end: true,
        object: 'subscription' as const,
      }),
    ),

    resumeSubscription: vi.fn().mockImplementation((subscriptionId) =>
      Effect.succeed({
        id: subscriptionId,
        status: 'active',
        cancel_at_period_end: false,
        object: 'subscription' as const,
      }),
    ),

    listInvoices: vi.fn().mockImplementation(() =>
      Effect.succeed({
        data: [{ id: 'in_test123', object: 'invoice' as const }],
        has_more: false,
        object: 'list' as const,
        url: '/v1/invoices',
      }),
    ),

    getInvoice: vi.fn().mockImplementation((invoiceId) =>
      Effect.succeed({
        id: invoiceId,
        status: 'paid',
        object: 'invoice' as const,
      }),
    ),

    getUpcomingInvoice: vi.fn().mockImplementation(() =>
      Effect.succeed({
        amount_due: 2900,
        object: 'invoice' as const,
      }),
    ),

    listPaymentMethods: vi.fn().mockImplementation(() =>
      Effect.succeed({
        data: [{ id: 'pm_test123', type: 'card', object: 'payment_method' as const }],
        has_more: false,
        object: 'list' as const,
        url: '/v1/payment_methods',
      }),
    ),

    attachPaymentMethod: vi.fn().mockImplementation((paymentMethodId) =>
      Effect.succeed({
        id: paymentMethodId,
        customer: 'cus_test123',
        object: 'payment_method' as const,
      }),
    ),

    detachPaymentMethod: vi.fn().mockImplementation((paymentMethodId) =>
      Effect.succeed({
        id: paymentMethodId,
        customer: null,
        object: 'payment_method' as const,
      }),
    ),

    setDefaultPaymentMethod: vi.fn().mockImplementation((customerId) =>
      Effect.succeed({
        id: customerId,
        invoice_settings: { default_payment_method: 'pm_test123' },
        object: 'customer' as const,
      }),
    ),

    constructWebhookEvent: vi.fn().mockImplementation(() =>
      Effect.succeed({
        id: 'evt_test123',
        type: 'customer.subscription.updated',
        object: 'event' as const,
        data: { object: { id: 'sub_123' } },
      }),
    ),

    listPrices: vi.fn().mockImplementation(() =>
      Effect.succeed({
        data: [{ id: 'price_test123', unit_amount: 2900, object: 'price' as const }],
        has_more: false,
        object: 'list' as const,
        url: '/v1/prices',
      }),
    ),

    createPrice: vi.fn().mockImplementation(() =>
      Effect.succeed({
        id: 'price_new123',
        unit_amount: 2900,
        currency: 'usd',
        object: 'price' as const,
      }),
    ),
  });

  const createTestLayer = (service: StripeService) => Layer.succeed(StripeServiceTag, service);

  describe('createCustomer', () => {
    it('should create a customer successfully', async () => {
      const mockService = createMockStripeService();
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.createCustomer({
          email: 'test@example.com',
          name: 'Test User',
        });
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.id).toBe('cus_test123');
      expect(result.email).toBe('test@example.com');
    });

    it('should handle API errors', async () => {
      const mockService = createMockStripeService();
      (mockService as { createCustomer: unknown }).createCustomer = vi
        .fn()
        .mockImplementation(() => Effect.fail(new StripeApiError({ message: 'Invalid email' })));
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.createCustomer({ email: 'invalid' });
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe('getCustomer', () => {
    it('should retrieve a customer', async () => {
      const mockService = createMockStripeService();
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.getCustomer('cus_test123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.id).toBe('cus_test123');
    });

    it('should handle customer not found', async () => {
      const mockService = createMockStripeService();
      (mockService as { getCustomer: unknown }).getCustomer = vi
        .fn()
        .mockImplementation(() => Effect.fail(new StripeApiError({ message: 'No such customer' })));
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.getCustomer('cus_nonexistent');
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe('createCheckoutSession', () => {
    it('should create a checkout session', async () => {
      const mockService = createMockStripeService();
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.createCheckoutSession({
          customerId: 'cus_123',
          priceId: 'price_123',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        });
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.id).toBe('cs_test123');
      expect(result.url).toContain('checkout.stripe.com');
    });
  });

  describe('createPortalSession', () => {
    it('should create a billing portal session', async () => {
      const mockService = createMockStripeService();
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.createPortalSession({
          customerId: 'cus_123',
          returnUrl: 'https://example.com/settings',
        });
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.id).toBe('bps_test123');
      expect(result.url).toContain('billing.stripe.com');
    });
  });

  describe('getSubscription', () => {
    it('should retrieve a subscription', async () => {
      const mockService = createMockStripeService();
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.getSubscription('sub_test123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.id).toBe('sub_test123');
      expect(result.status).toBe('active');
    });
  });

  describe('updateSubscription', () => {
    it('should update a subscription', async () => {
      const mockService = createMockStripeService();
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.updateSubscription('sub_test123', {});
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.id).toBe('sub_test123');
    });
  });

  describe('cancelSubscriptionAtPeriodEnd', () => {
    it('should cancel subscription at period end', async () => {
      const mockService = createMockStripeService();
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.cancelSubscriptionAtPeriodEnd('sub_test123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.cancel_at_period_end).toBe(true);
    });
  });

  describe('resumeSubscription', () => {
    it('should resume a canceled subscription', async () => {
      const mockService = createMockStripeService();
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.resumeSubscription('sub_test123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.cancel_at_period_end).toBe(false);
    });
  });

  describe('listInvoices', () => {
    it('should list invoices for a customer', async () => {
      const mockService = createMockStripeService();
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.listInvoices('cus_123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.data).toHaveLength(1);
    });
  });

  describe('getInvoice', () => {
    it('should retrieve an invoice', async () => {
      const mockService = createMockStripeService();
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.getInvoice('in_test123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.id).toBe('in_test123');
      expect(result.status).toBe('paid');
    });
  });

  describe('getUpcomingInvoice', () => {
    it('should get upcoming invoice preview', async () => {
      const mockService = createMockStripeService();
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.getUpcomingInvoice({
          customerId: 'cus_123',
        });
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.amount_due).toBe(2900);
    });
  });

  describe('listPaymentMethods', () => {
    it('should list payment methods for a customer', async () => {
      const mockService = createMockStripeService();
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.listPaymentMethods('cus_123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.data).toHaveLength(1);
    });
  });

  describe('attachPaymentMethod', () => {
    it('should attach a payment method to a customer', async () => {
      const mockService = createMockStripeService();
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.attachPaymentMethod('pm_test123', 'cus_123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.id).toBe('pm_test123');
      expect(result.customer).toBe('cus_test123');
    });
  });

  describe('detachPaymentMethod', () => {
    it('should detach a payment method', async () => {
      const mockService = createMockStripeService();
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.detachPaymentMethod('pm_test123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.customer).toBeNull();
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('should set default payment method for customer', async () => {
      const mockService = createMockStripeService();
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.setDefaultPaymentMethod('cus_123', 'pm_test123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.invoice_settings.default_payment_method).toBe('pm_test123');
    });
  });

  describe('constructWebhookEvent', () => {
    it('should construct a webhook event', async () => {
      const mockService = createMockStripeService();
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.constructWebhookEvent('{"id":"evt_test123"}', 't=1234,v1=abc');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.id).toBe('evt_test123');
      expect(result.type).toBe('customer.subscription.updated');
    });

    it('should fail with invalid signature', async () => {
      const mockService = createMockStripeService();
      (mockService as { constructWebhookEvent: unknown }).constructWebhookEvent = vi
        .fn()
        .mockImplementation(() => Effect.fail(new WebhookSignatureError({ message: 'Invalid signature' })));
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.constructWebhookEvent('{"id":"evt_test123"}', 'invalid_signature');
      });

      const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe('listPrices', () => {
    it('should list prices for a product', async () => {
      const mockService = createMockStripeService();
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.listPrices('prod_123');
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.data).toHaveLength(1);
    });
  });

  describe('createPrice', () => {
    it('should create a price', async () => {
      const mockService = createMockStripeService();
      const testLayer = createTestLayer(mockService);

      const program = Effect.gen(function* () {
        const stripe = yield* StripeServiceTag;
        return yield* stripe.createPrice({
          unit_amount: 2900,
          currency: 'usd',
          recurring: { interval: 'month' },
          product: 'prod_123',
        });
      });

      const result = await Effect.runPromise(Effect.provide(program, testLayer));

      expect(result.id).toBe('price_new123');
      expect(result.unit_amount).toBe(2900);
    });
  });
});
