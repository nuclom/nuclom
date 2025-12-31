/**
 * Stripe Service using Effect-TS
 *
 * Provides type-safe Stripe API integration with Effect's execution model.
 */

import { Config, Context, Effect, Layer, Redacted } from "effect";
import Stripe from "stripe";
import { StripeApiError, WebhookSignatureError } from "../errors";

// =============================================================================
// Types
// =============================================================================

export interface StripeService {
  readonly client: Stripe;

  /**
   * Create a Stripe customer
   */
  readonly createCustomer: (params: {
    email: string;
    name?: string;
    metadata?: Record<string, string>;
  }) => Effect.Effect<Stripe.Customer, StripeApiError>;

  /**
   * Get a Stripe customer
   */
  readonly getCustomer: (customerId: string) => Effect.Effect<Stripe.Customer, StripeApiError>;

  /**
   * Create a checkout session for subscription
   */
  readonly createCheckoutSession: (params: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
    trialPeriodDays?: number;
  }) => Effect.Effect<Stripe.Checkout.Session, StripeApiError>;

  /**
   * Create a billing portal session
   */
  readonly createPortalSession: (params: {
    customerId: string;
    returnUrl: string;
  }) => Effect.Effect<Stripe.BillingPortal.Session, StripeApiError>;

  /**
   * Get a subscription
   */
  readonly getSubscription: (subscriptionId: string) => Effect.Effect<Stripe.Subscription, StripeApiError>;

  /**
   * Update a subscription
   */
  readonly updateSubscription: (
    subscriptionId: string,
    params: Stripe.SubscriptionUpdateParams,
  ) => Effect.Effect<Stripe.Subscription, StripeApiError>;

  /**
   * Cancel a subscription at period end
   */
  readonly cancelSubscriptionAtPeriodEnd: (
    subscriptionId: string,
  ) => Effect.Effect<Stripe.Subscription, StripeApiError>;

  /**
   * Resume a canceled subscription
   */
  readonly resumeSubscription: (subscriptionId: string) => Effect.Effect<Stripe.Subscription, StripeApiError>;

  /**
   * List invoices for a customer
   */
  readonly listInvoices: (
    customerId: string,
    params?: { limit?: number; starting_after?: string },
  ) => Effect.Effect<Stripe.ApiList<Stripe.Invoice>, StripeApiError>;

  /**
   * Get an invoice
   */
  readonly getInvoice: (invoiceId: string) => Effect.Effect<Stripe.Invoice, StripeApiError>;

  /**
   * Get upcoming invoice
   */
  readonly getUpcomingInvoice: (params: {
    customerId: string;
    subscriptionId?: string;
    priceId?: string;
  }) => Effect.Effect<Stripe.UpcomingInvoice, StripeApiError>;

  /**
   * List payment methods for a customer
   */
  readonly listPaymentMethods: (
    customerId: string,
    type?: Stripe.PaymentMethodListParams.Type,
  ) => Effect.Effect<Stripe.ApiList<Stripe.PaymentMethod>, StripeApiError>;

  /**
   * Attach a payment method to a customer
   */
  readonly attachPaymentMethod: (
    paymentMethodId: string,
    customerId: string,
  ) => Effect.Effect<Stripe.PaymentMethod, StripeApiError>;

  /**
   * Detach a payment method
   */
  readonly detachPaymentMethod: (paymentMethodId: string) => Effect.Effect<Stripe.PaymentMethod, StripeApiError>;

  /**
   * Set default payment method for customer
   */
  readonly setDefaultPaymentMethod: (
    customerId: string,
    paymentMethodId: string,
  ) => Effect.Effect<Stripe.Customer, StripeApiError>;

  /**
   * Construct a webhook event from raw body and signature
   */
  readonly constructWebhookEvent: (
    body: string,
    signature: string,
  ) => Effect.Effect<Stripe.Event, WebhookSignatureError>;

  /**
   * Get prices for a product
   */
  readonly listPrices: (productId?: string) => Effect.Effect<Stripe.ApiList<Stripe.Price>, StripeApiError>;

  /**
   * Create a price
   */
  readonly createPrice: (params: Stripe.PriceCreateParams) => Effect.Effect<Stripe.Price, StripeApiError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class StripeServiceTag extends Context.Tag("StripeService")<StripeServiceTag, StripeService>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const makeStripeService = (client: Stripe, webhookSecret: string): StripeService => ({
  client,

  createCustomer: (params) =>
    Effect.tryPromise({
      try: () =>
        client.customers.create({
          email: params.email,
          name: params.name,
          metadata: params.metadata,
        }),
      catch: (error) =>
        new StripeApiError({
          message: `Failed to create customer: ${error instanceof Error ? error.message : String(error)}`,
          code: error instanceof Stripe.errors.StripeError ? error.code : undefined,
          cause: error,
        }),
    }),

  getCustomer: (customerId) =>
    Effect.tryPromise({
      try: () => client.customers.retrieve(customerId) as Promise<Stripe.Customer>,
      catch: (error) =>
        new StripeApiError({
          message: `Failed to get customer: ${error instanceof Error ? error.message : String(error)}`,
          code: error instanceof Stripe.errors.StripeError ? error.code : undefined,
          cause: error,
        }),
    }),

  createCheckoutSession: (params) =>
    Effect.tryPromise({
      try: () =>
        client.checkout.sessions.create({
          customer: params.customerId,
          mode: "subscription",
          line_items: [
            {
              price: params.priceId,
              quantity: 1,
            },
          ],
          success_url: params.successUrl,
          cancel_url: params.cancelUrl,
          metadata: params.metadata,
          subscription_data: params.trialPeriodDays ? { trial_period_days: params.trialPeriodDays } : undefined,
        }),
      catch: (error) =>
        new StripeApiError({
          message: `Failed to create checkout session: ${error instanceof Error ? error.message : String(error)}`,
          code: error instanceof Stripe.errors.StripeError ? error.code : undefined,
          cause: error,
        }),
    }),

  createPortalSession: (params) =>
    Effect.tryPromise({
      try: () =>
        client.billingPortal.sessions.create({
          customer: params.customerId,
          return_url: params.returnUrl,
        }),
      catch: (error) =>
        new StripeApiError({
          message: `Failed to create portal session: ${error instanceof Error ? error.message : String(error)}`,
          code: error instanceof Stripe.errors.StripeError ? error.code : undefined,
          cause: error,
        }),
    }),

  getSubscription: (subscriptionId) =>
    Effect.tryPromise({
      try: () => client.subscriptions.retrieve(subscriptionId),
      catch: (error) =>
        new StripeApiError({
          message: `Failed to get subscription: ${error instanceof Error ? error.message : String(error)}`,
          code: error instanceof Stripe.errors.StripeError ? error.code : undefined,
          cause: error,
        }),
    }),

  updateSubscription: (subscriptionId, params) =>
    Effect.tryPromise({
      try: () => client.subscriptions.update(subscriptionId, params),
      catch: (error) =>
        new StripeApiError({
          message: `Failed to update subscription: ${error instanceof Error ? error.message : String(error)}`,
          code: error instanceof Stripe.errors.StripeError ? error.code : undefined,
          cause: error,
        }),
    }),

  cancelSubscriptionAtPeriodEnd: (subscriptionId) =>
    Effect.tryPromise({
      try: () =>
        client.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        }),
      catch: (error) =>
        new StripeApiError({
          message: `Failed to cancel subscription: ${error instanceof Error ? error.message : String(error)}`,
          code: error instanceof Stripe.errors.StripeError ? error.code : undefined,
          cause: error,
        }),
    }),

  resumeSubscription: (subscriptionId) =>
    Effect.tryPromise({
      try: () =>
        client.subscriptions.update(subscriptionId, {
          cancel_at_period_end: false,
        }),
      catch: (error) =>
        new StripeApiError({
          message: `Failed to resume subscription: ${error instanceof Error ? error.message : String(error)}`,
          code: error instanceof Stripe.errors.StripeError ? error.code : undefined,
          cause: error,
        }),
    }),

  listInvoices: (customerId, params) =>
    Effect.tryPromise({
      try: () =>
        client.invoices.list({
          customer: customerId,
          limit: params?.limit ?? 10,
          starting_after: params?.starting_after,
        }),
      catch: (error) =>
        new StripeApiError({
          message: `Failed to list invoices: ${error instanceof Error ? error.message : String(error)}`,
          code: error instanceof Stripe.errors.StripeError ? error.code : undefined,
          cause: error,
        }),
    }),

  getInvoice: (invoiceId) =>
    Effect.tryPromise({
      try: () => client.invoices.retrieve(invoiceId),
      catch: (error) =>
        new StripeApiError({
          message: `Failed to get invoice: ${error instanceof Error ? error.message : String(error)}`,
          code: error instanceof Stripe.errors.StripeError ? error.code : undefined,
          cause: error,
        }),
    }),

  getUpcomingInvoice: (params) =>
    Effect.tryPromise({
      try: () =>
        client.invoices.createPreview({
          customer: params.customerId,
          subscription: params.subscriptionId,
        }),
      catch: (error) =>
        new StripeApiError({
          message: `Failed to get upcoming invoice: ${error instanceof Error ? error.message : String(error)}`,
          code: error instanceof Stripe.errors.StripeError ? error.code : undefined,
          cause: error,
        }),
    }),

  listPaymentMethods: (customerId, type = "card") =>
    Effect.tryPromise({
      try: () =>
        client.paymentMethods.list({
          customer: customerId,
          type,
        }),
      catch: (error) =>
        new StripeApiError({
          message: `Failed to list payment methods: ${error instanceof Error ? error.message : String(error)}`,
          code: error instanceof Stripe.errors.StripeError ? error.code : undefined,
          cause: error,
        }),
    }),

  attachPaymentMethod: (paymentMethodId, customerId) =>
    Effect.tryPromise({
      try: () =>
        client.paymentMethods.attach(paymentMethodId, {
          customer: customerId,
        }),
      catch: (error) =>
        new StripeApiError({
          message: `Failed to attach payment method: ${error instanceof Error ? error.message : String(error)}`,
          code: error instanceof Stripe.errors.StripeError ? error.code : undefined,
          cause: error,
        }),
    }),

  detachPaymentMethod: (paymentMethodId) =>
    Effect.tryPromise({
      try: () => client.paymentMethods.detach(paymentMethodId),
      catch: (error) =>
        new StripeApiError({
          message: `Failed to detach payment method: ${error instanceof Error ? error.message : String(error)}`,
          code: error instanceof Stripe.errors.StripeError ? error.code : undefined,
          cause: error,
        }),
    }),

  setDefaultPaymentMethod: (customerId, paymentMethodId) =>
    Effect.tryPromise({
      try: () =>
        client.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        }),
      catch: (error) =>
        new StripeApiError({
          message: `Failed to set default payment method: ${error instanceof Error ? error.message : String(error)}`,
          code: error instanceof Stripe.errors.StripeError ? error.code : undefined,
          cause: error,
        }),
    }),

  constructWebhookEvent: (body, signature) =>
    Effect.try({
      try: () => client.webhooks.constructEvent(body, signature, webhookSecret),
      catch: (error) =>
        new WebhookSignatureError({
          message: `Webhook signature verification failed: ${error instanceof Error ? error.message : String(error)}`,
        }),
    }),

  listPrices: (productId) =>
    Effect.tryPromise({
      try: () =>
        client.prices.list({
          product: productId,
          active: true,
        }),
      catch: (error) =>
        new StripeApiError({
          message: `Failed to list prices: ${error instanceof Error ? error.message : String(error)}`,
          code: error instanceof Stripe.errors.StripeError ? error.code : undefined,
          cause: error,
        }),
    }),

  createPrice: (params) =>
    Effect.tryPromise({
      try: () => client.prices.create(params),
      catch: (error) =>
        new StripeApiError({
          message: `Failed to create price: ${error instanceof Error ? error.message : String(error)}`,
          code: error instanceof Stripe.errors.StripeError ? error.code : undefined,
          cause: error,
        }),
    }),
});

// =============================================================================
// Service Layer
// =============================================================================

export const StripeServiceLive = Layer.effect(
  StripeServiceTag,
  Effect.gen(function* () {
    const secretKey = yield* Config.redacted("STRIPE_SECRET_KEY");
    const webhookSecret = yield* Config.redacted("STRIPE_WEBHOOK_SECRET");

    const client = new Stripe(Redacted.value(secretKey), {
      apiVersion: "2025-12-15.clover",
      typescript: true,
    });

    return makeStripeService(client, Redacted.value(webhookSecret));
  }),
);

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the Stripe service
 */
export const getStripe = Effect.serviceFunction(StripeServiceTag, (service) => () => service);
