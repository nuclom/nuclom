/**
 * Zapier Webhooks Service using Effect-TS
 *
 * Provides webhook management and delivery for Zapier integration.
 */

import crypto from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Context, Effect, Layer } from 'effect';
import type {
  NewZapierWebhookDelivery,
  ZapierWebhook,
  ZapierWebhookDelivery,
  ZapierWebhookEvent,
} from '../../db/schema';
import { zapierWebhookDeliveries, zapierWebhooks } from '../../db/schema';
import { DatabaseError, NotFoundError } from '../errors';
import { Database } from './database';

// =============================================================================
// Types
// =============================================================================

export interface CreateWebhookInput {
  readonly organizationId: string;
  readonly userId: string;
  readonly targetUrl: string;
  readonly events: ZapierWebhookEvent[];
}

export interface UpdateWebhookInput {
  readonly targetUrl?: string;
  readonly events?: ZapierWebhookEvent[];
  readonly isActive?: boolean;
}

export interface WebhookPayload {
  readonly event: ZapierWebhookEvent;
  readonly timestamp: string;
  readonly organizationId: string;
  readonly data: Record<string, unknown>;
}

export interface WebhookDeliveryResult {
  readonly success: boolean;
  readonly statusCode?: number;
  readonly error?: string;
  readonly deliveryId: string;
}

export interface WebhookWithStats extends ZapierWebhook {
  readonly deliveryCount: number;
  readonly successCount: number;
  readonly lastDeliveryAt: Date | null;
}

// =============================================================================
// Zapier Webhooks Service Interface
// =============================================================================

export interface ZapierWebhooksServiceInterface {
  /**
   * Get all webhooks for an organization
   */
  readonly getWebhooks: (organizationId: string) => Effect.Effect<WebhookWithStats[], DatabaseError>;

  /**
   * Get a specific webhook
   */
  readonly getWebhook: (id: string) => Effect.Effect<ZapierWebhook, DatabaseError | NotFoundError>;

  /**
   * Create a new webhook
   */
  readonly createWebhook: (data: CreateWebhookInput) => Effect.Effect<ZapierWebhook, DatabaseError>;

  /**
   * Update a webhook
   */
  readonly updateWebhook: (
    id: string,
    data: UpdateWebhookInput,
  ) => Effect.Effect<ZapierWebhook, DatabaseError | NotFoundError>;

  /**
   * Delete a webhook
   */
  readonly deleteWebhook: (id: string) => Effect.Effect<void, DatabaseError | NotFoundError>;

  /**
   * Get webhooks for a specific event in an organization
   */
  readonly getWebhooksForEvent: (
    organizationId: string,
    event: ZapierWebhookEvent,
  ) => Effect.Effect<ZapierWebhook[], DatabaseError>;

  /**
   * Trigger webhooks for an event
   */
  readonly triggerWebhooks: (
    organizationId: string,
    event: ZapierWebhookEvent,
    data: Record<string, unknown>,
  ) => Effect.Effect<WebhookDeliveryResult[], DatabaseError>;

  /**
   * Deliver a webhook payload to a URL
   */
  readonly deliverWebhook: (
    webhook: ZapierWebhook,
    payload: WebhookPayload,
  ) => Effect.Effect<WebhookDeliveryResult, DatabaseError>;

  /**
   * Get delivery history for a webhook
   */
  readonly getDeliveries: (
    webhookId: string,
    page?: number,
    limit?: number,
  ) => Effect.Effect<{ data: ZapierWebhookDelivery[]; total: number }, DatabaseError>;

  /**
   * Retry a failed delivery
   */
  readonly retryDelivery: (deliveryId: string) => Effect.Effect<WebhookDeliveryResult, DatabaseError | NotFoundError>;

  /**
   * Generate a signature for a payload
   */
  readonly generateSignature: (secret: string, payload: string) => string;

  /**
   * Verify a signature
   */
  readonly verifySignature: (secret: string, payload: string, signature: string) => boolean;
}

// =============================================================================
// Zapier Webhooks Service Tag
// =============================================================================

export class ZapierWebhooksService extends Context.Tag('ZapierWebhooksService')<
  ZapierWebhooksService,
  ZapierWebhooksServiceInterface
>() {}

// =============================================================================
// Zapier Webhooks Service Implementation
// =============================================================================

const makeZapierWebhooksService = Effect.gen(function* () {
  const { db } = yield* Database;

  const generateSecret = (): string => {
    return crypto.randomBytes(32).toString('hex');
  };

  const generateSignature = (secret: string, payload: string): string => {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
  };

  const verifySignature = (secret: string, payload: string, signature: string): boolean => {
    const expectedSignature = generateSignature(secret, payload);
    try {
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  };

  const getWebhooks = (organizationId: string): Effect.Effect<WebhookWithStats[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const webhooks = await db
          .select()
          .from(zapierWebhooks)
          .where(eq(zapierWebhooks.organizationId, organizationId))
          .orderBy(desc(zapierWebhooks.createdAt));

        // Get stats for each webhook
        const webhooksWithStats = await Promise.all(
          webhooks.map(async (webhook) => {
            const [stats] = await db
              .select({
                deliveryCount: sql<number>`count(*)::int`,
                successCount: sql<number>`sum(case when ${zapierWebhookDeliveries.success} then 1 else 0 end)::int`,
                lastDeliveryAt: sql<Date | null>`max(${zapierWebhookDeliveries.createdAt})`,
              })
              .from(zapierWebhookDeliveries)
              .where(eq(zapierWebhookDeliveries.webhookId, webhook.id));

            return {
              ...webhook,
              deliveryCount: stats?.deliveryCount ?? 0,
              successCount: stats?.successCount ?? 0,
              lastDeliveryAt: stats?.lastDeliveryAt ?? null,
            };
          }),
        );

        return webhooksWithStats;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch webhooks',
          operation: 'getWebhooks',
          cause: error,
        }),
    });

  const getWebhook = (id: string): Effect.Effect<ZapierWebhook, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db.select().from(zapierWebhooks).where(eq(zapierWebhooks.id, id)).limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to fetch webhook',
            operation: 'getWebhook',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Webhook not found',
            entity: 'ZapierWebhook',
            id,
          }),
        );
      }

      return result[0];
    });

  const createWebhook = (data: CreateWebhookInput): Effect.Effect<ZapierWebhook, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const [webhook] = await db
          .insert(zapierWebhooks)
          .values({
            ...data,
            events: data.events,
            secret: generateSecret(),
          })
          .returning();
        return webhook;
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to create webhook',
          operation: 'createWebhook',
          cause: error,
        }),
    });

  const updateWebhook = (
    id: string,
    data: UpdateWebhookInput,
  ): Effect.Effect<ZapierWebhook, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .update(zapierWebhooks)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(zapierWebhooks.id, id))
            .returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to update webhook',
            operation: 'updateWebhook',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Webhook not found',
            entity: 'ZapierWebhook',
            id,
          }),
        );
      }

      return result[0];
    });

  const deleteWebhook = (id: string): Effect.Effect<void, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      const result = yield* Effect.tryPromise({
        try: async () => {
          return await db.delete(zapierWebhooks).where(eq(zapierWebhooks.id, id)).returning();
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to delete webhook',
            operation: 'deleteWebhook',
            cause: error,
          }),
      });

      if (!result.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Webhook not found',
            entity: 'ZapierWebhook',
            id,
          }),
        );
      }
    });

  const getWebhooksForEvent = (
    organizationId: string,
    event: ZapierWebhookEvent,
  ): Effect.Effect<ZapierWebhook[], DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const webhooks = await db
          .select()
          .from(zapierWebhooks)
          .where(and(eq(zapierWebhooks.organizationId, organizationId), eq(zapierWebhooks.isActive, true)));

        // Filter webhooks that subscribe to this event
        return webhooks.filter((webhook) => {
          const events = webhook.events as string[];
          return events.includes(event);
        });
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch webhooks for event',
          operation: 'getWebhooksForEvent',
          cause: error,
        }),
    });

  const deliverWebhook = (
    webhook: ZapierWebhook,
    payload: WebhookPayload,
  ): Effect.Effect<WebhookDeliveryResult, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const payloadString = JSON.stringify(payload);
        const signature = generateSignature(webhook.secret, payloadString);

        let success = false;
        let statusCode: number | undefined;
        let responseBody: string | undefined;
        let error: string | undefined;

        try {
          const response = await fetch(webhook.targetUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Nuclom-Signature': signature,
              'X-Nuclom-Event': payload.event,
              'X-Nuclom-Timestamp': payload.timestamp,
            },
            body: payloadString,
            signal: AbortSignal.timeout(30000), // 30 second timeout
          });

          statusCode = response.status;
          responseBody = await response.text().catch(() => undefined);
          success = response.ok;
        } catch (err) {
          error = err instanceof Error ? err.message : 'Unknown error';
          success = false;
        }

        // Record the delivery
        const deliveryData: NewZapierWebhookDelivery = {
          webhookId: webhook.id,
          event: payload.event,
          payload: payload as unknown as Record<string, unknown>,
          responseStatus: statusCode,
          responseBody: responseBody?.slice(0, 1000), // Limit response body size
          success,
          deliveredAt: success ? new Date() : null,
        };
        const [delivery] = await db.insert(zapierWebhookDeliveries).values(deliveryData).returning();

        // Update webhook stats
        if (!success) {
          await db
            .update(zapierWebhooks)
            .set({
              failureCount: sql`${zapierWebhooks.failureCount} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(zapierWebhooks.id, webhook.id));
        } else {
          await db
            .update(zapierWebhooks)
            .set({
              lastTriggeredAt: new Date(),
              failureCount: 0,
              updatedAt: new Date(),
            })
            .where(eq(zapierWebhooks.id, webhook.id));
        }

        return {
          success,
          statusCode,
          error,
          deliveryId: delivery.id,
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to deliver webhook',
          operation: 'deliverWebhook',
          cause: error,
        }),
    });

  const triggerWebhooks = (
    organizationId: string,
    event: ZapierWebhookEvent,
    data: Record<string, unknown>,
  ): Effect.Effect<WebhookDeliveryResult[], DatabaseError> =>
    Effect.gen(function* () {
      const webhooks = yield* getWebhooksForEvent(organizationId, event);

      const payload: WebhookPayload = {
        event,
        timestamp: new Date().toISOString(),
        organizationId,
        data,
      };

      const results: WebhookDeliveryResult[] = [];

      for (const webhook of webhooks) {
        const result = yield* deliverWebhook(webhook, payload);
        results.push(result);
      }

      return results;
    });

  const getDeliveries = (
    webhookId: string,
    page = 1,
    limit = 20,
  ): Effect.Effect<{ data: ZapierWebhookDelivery[]; total: number }, DatabaseError> =>
    Effect.tryPromise({
      try: async () => {
        const offset = (page - 1) * limit;

        const [deliveries, totalResult] = await Promise.all([
          db
            .select()
            .from(zapierWebhookDeliveries)
            .where(eq(zapierWebhookDeliveries.webhookId, webhookId))
            .orderBy(desc(zapierWebhookDeliveries.createdAt))
            .limit(limit)
            .offset(offset),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(zapierWebhookDeliveries)
            .where(eq(zapierWebhookDeliveries.webhookId, webhookId)),
        ]);

        return {
          data: deliveries,
          total: totalResult[0]?.count ?? 0,
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: 'Failed to fetch deliveries',
          operation: 'getDeliveries',
          cause: error,
        }),
    });

  const retryDelivery = (deliveryId: string): Effect.Effect<WebhookDeliveryResult, DatabaseError | NotFoundError> =>
    Effect.gen(function* () {
      // Get the original delivery
      const deliveryResult = yield* Effect.tryPromise({
        try: async () => {
          return await db
            .select()
            .from(zapierWebhookDeliveries)
            .where(eq(zapierWebhookDeliveries.id, deliveryId))
            .limit(1);
        },
        catch: (error) =>
          new DatabaseError({
            message: 'Failed to fetch delivery',
            operation: 'retryDelivery',
            cause: error,
          }),
      });

      if (!deliveryResult.length) {
        return yield* Effect.fail(
          new NotFoundError({
            message: 'Delivery not found',
            entity: 'ZapierWebhookDelivery',
            id: deliveryId,
          }),
        );
      }

      const delivery = deliveryResult[0];

      // Get the webhook
      const webhook = yield* getWebhook(delivery.webhookId);

      // Retry the delivery
      const payload = delivery.payload as unknown as WebhookPayload;
      return yield* deliverWebhook(webhook, payload);
    });

  return {
    getWebhooks,
    getWebhook,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    getWebhooksForEvent,
    triggerWebhooks,
    deliverWebhook,
    getDeliveries,
    retryDelivery,
    generateSignature,
    verifySignature,
  } satisfies ZapierWebhooksServiceInterface;
});

// =============================================================================
// Zapier Webhooks Service Layer
// =============================================================================

export const ZapierWebhooksServiceLive = Layer.effect(ZapierWebhooksService, makeZapierWebhooksService);

// =============================================================================
// Zapier Webhooks Helper Functions
// =============================================================================

export const getZapierWebhooks = (
  organizationId: string,
): Effect.Effect<WebhookWithStats[], DatabaseError, ZapierWebhooksService> =>
  Effect.gen(function* () {
    const service = yield* ZapierWebhooksService;
    return yield* service.getWebhooks(organizationId);
  });

export const createZapierWebhook = (
  data: CreateWebhookInput,
): Effect.Effect<ZapierWebhook, DatabaseError, ZapierWebhooksService> =>
  Effect.gen(function* () {
    const service = yield* ZapierWebhooksService;
    return yield* service.createWebhook(data);
  });

export const updateZapierWebhook = (
  id: string,
  data: UpdateWebhookInput,
): Effect.Effect<ZapierWebhook, DatabaseError | NotFoundError, ZapierWebhooksService> =>
  Effect.gen(function* () {
    const service = yield* ZapierWebhooksService;
    return yield* service.updateWebhook(id, data);
  });

export const deleteZapierWebhook = (
  id: string,
): Effect.Effect<void, DatabaseError | NotFoundError, ZapierWebhooksService> =>
  Effect.gen(function* () {
    const service = yield* ZapierWebhooksService;
    return yield* service.deleteWebhook(id);
  });

export const triggerZapierWebhooks = (
  organizationId: string,
  event: ZapierWebhookEvent,
  data: Record<string, unknown>,
): Effect.Effect<WebhookDeliveryResult[], DatabaseError, ZapierWebhooksService> =>
  Effect.gen(function* () {
    const service = yield* ZapierWebhooksService;
    return yield* service.triggerWebhooks(organizationId, event, data);
  });

export const getZapierWebhookDeliveries = (
  webhookId: string,
  page?: number,
  limit?: number,
): Effect.Effect<{ data: ZapierWebhookDelivery[]; total: number }, DatabaseError, ZapierWebhooksService> =>
  Effect.gen(function* () {
    const service = yield* ZapierWebhooksService;
    return yield* service.getDeliveries(webhookId, page, limit);
  });

export const retryZapierWebhookDelivery = (
  deliveryId: string,
): Effect.Effect<WebhookDeliveryResult, DatabaseError | NotFoundError, ZapierWebhooksService> =>
  Effect.gen(function* () {
    const service = yield* ZapierWebhooksService;
    return yield* service.retryDelivery(deliveryId);
  });
