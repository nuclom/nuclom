/**
 * Referral Repository Service using Effect-TS
 *
 * Provides database operations for referral program entities.
 */

import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { Context, Effect, Layer, Option } from "effect";
import {
  type NewReferral,
  type NewReferralCode,
  type NewReferralReward,
  type Referral,
  type ReferralCode,
  type ReferralProgram,
  type ReferralReward,
  referralCodes,
  referralPrograms,
  referralRewards,
  referrals,
  users,
} from "@/lib/db/schema";
import { DatabaseError, NotFoundError } from "../errors";
import { Database, type DrizzleDB } from "./database";

// =============================================================================
// Types
// =============================================================================

export interface ReferralStats {
  totalReferrals: number;
  pendingReferrals: number;
  convertedReferrals: number;
  totalEarnings: number;
  pendingRewards: number;
}

export interface ReferralWithUser extends Referral {
  referredUser: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  } | null;
}

export interface ReferralCodeWithStats extends ReferralCode {
  stats: {
    totalUses: number;
    signups: number;
    conversions: number;
  };
}

// =============================================================================
// Custom Errors
// =============================================================================

export class ReferralCodeNotFoundError {
  readonly _tag = "ReferralCodeNotFoundError";
  constructor(readonly code: string) {}
}

export class ReferralCodeExpiredError {
  readonly _tag = "ReferralCodeExpiredError";
  constructor(readonly code: string) {}
}

export class ReferralCodeMaxUsesError {
  readonly _tag = "ReferralCodeMaxUsesError";
  constructor(readonly code: string) {}
}

export class DuplicateReferralError {
  readonly _tag = "DuplicateReferralError";
  constructor(readonly email: string) {}
}

// =============================================================================
// Service Interface
// =============================================================================

export interface ReferralRepositoryService {
  // Referral Codes
  readonly createReferralCode: (
    data: NewReferralCode,
  ) => Effect.Effect<ReferralCode, DatabaseError>;
  readonly getReferralCode: (
    id: string,
  ) => Effect.Effect<ReferralCode, NotFoundError | DatabaseError>;
  readonly getReferralCodeByCode: (
    code: string,
  ) => Effect.Effect<
    ReferralCode,
    ReferralCodeNotFoundError | ReferralCodeExpiredError | ReferralCodeMaxUsesError | DatabaseError
  >;
  readonly getUserReferralCodes: (
    userId: string,
  ) => Effect.Effect<ReferralCodeWithStats[], DatabaseError>;
  readonly incrementReferralCodeUsage: (
    id: string,
  ) => Effect.Effect<void, NotFoundError | DatabaseError>;
  readonly deactivateReferralCode: (
    id: string,
  ) => Effect.Effect<void, NotFoundError | DatabaseError>;

  // Referrals
  readonly createReferral: (
    data: NewReferral,
  ) => Effect.Effect<Referral, DuplicateReferralError | DatabaseError>;
  readonly getReferral: (
    id: string,
  ) => Effect.Effect<Referral, NotFoundError | DatabaseError>;
  readonly getReferralByEmail: (
    email: string,
  ) => Effect.Effect<Option.Option<Referral>, DatabaseError>;
  readonly getUserReferrals: (
    userId: string,
  ) => Effect.Effect<ReferralWithUser[], DatabaseError>;
  readonly updateReferralStatus: (
    id: string,
    status: Referral["status"],
    additionalData?: Partial<Referral>,
  ) => Effect.Effect<Referral, NotFoundError | DatabaseError>;
  readonly getReferralStats: (
    userId: string,
  ) => Effect.Effect<ReferralStats, DatabaseError>;

  // Rewards
  readonly createReward: (
    data: NewReferralReward,
  ) => Effect.Effect<ReferralReward, DatabaseError>;
  readonly getUserRewards: (
    userId: string,
  ) => Effect.Effect<ReferralReward[], DatabaseError>;
  readonly getPendingRewards: (
    userId: string,
  ) => Effect.Effect<ReferralReward[], DatabaseError>;
  readonly claimReward: (
    rewardId: string,
    userId: string,
  ) => Effect.Effect<ReferralReward, NotFoundError | DatabaseError>;

  // Programs
  readonly getActiveProgram: () => Effect.Effect<Option.Option<ReferralProgram>, DatabaseError>;
  readonly getPrograms: () => Effect.Effect<ReferralProgram[], DatabaseError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class ReferralRepository extends Context.Tag("ReferralRepository")<
  ReferralRepository,
  ReferralRepositoryService
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const make = (db: DrizzleDB): ReferralRepositoryService => ({
  // -------------------------------------------------------------------------
  // Referral Codes
  // -------------------------------------------------------------------------

  createReferralCode: (data: NewReferralCode) =>
    Effect.tryPromise({
      try: async () => {
        const [code] = await db.insert(referralCodes).values(data).returning();
        return code;
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to create referral code: ${error instanceof Error ? error.message : String(error)}`,
        }),
    }),

  getReferralCode: (id: string) =>
    Effect.tryPromise({
      try: async () => {
        const [code] = await db.select().from(referralCodes).where(eq(referralCodes.id, id));
        if (!code) {
          throw new Error("Not found");
        }
        return code;
      },
      catch: (error) => {
        if (error instanceof Error && error.message === "Not found") {
          return new NotFoundError({ message: `Referral code ${id} not found` });
        }
        return new DatabaseError({
          message: `Failed to get referral code: ${error instanceof Error ? error.message : String(error)}`,
        });
      },
    }),

  getReferralCodeByCode: (code: string) =>
    Effect.tryPromise({
      try: async () => {
        const [referralCode] = await db
          .select()
          .from(referralCodes)
          .where(eq(referralCodes.code, code.toUpperCase()));

        if (!referralCode) {
          throw { type: "not_found", code };
        }

        if (!referralCode.isActive) {
          throw { type: "expired", code };
        }

        if (referralCode.expiresAt && new Date(referralCode.expiresAt) < new Date()) {
          throw { type: "expired", code };
        }

        if (referralCode.maxUses && referralCode.usageCount >= referralCode.maxUses) {
          throw { type: "max_uses", code };
        }

        return referralCode;
      },
      catch: (error) => {
        if (typeof error === "object" && error !== null && "type" in error) {
          const err = error as { type: string; code: string };
          switch (err.type) {
            case "not_found":
              return new ReferralCodeNotFoundError(err.code);
            case "expired":
              return new ReferralCodeExpiredError(err.code);
            case "max_uses":
              return new ReferralCodeMaxUsesError(err.code);
          }
        }
        return new DatabaseError({
          message: `Failed to get referral code: ${error instanceof Error ? error.message : String(error)}`,
        });
      },
    }),

  getUserReferralCodes: (userId: string) =>
    Effect.tryPromise({
      try: async () => {
        const codes = await db
          .select()
          .from(referralCodes)
          .where(eq(referralCodes.userId, userId))
          .orderBy(desc(referralCodes.createdAt));

        // Get stats for each code
        const codesWithStats = await Promise.all(
          codes.map(async (code) => {
            const codeReferrals = await db
              .select()
              .from(referrals)
              .where(eq(referrals.referralCodeId, code.id));

            const signups = codeReferrals.filter((r) => r.status !== "pending").length;
            const conversions = codeReferrals.filter((r) => r.status === "converted").length;

            return {
              ...code,
              stats: {
                totalUses: code.usageCount,
                signups,
                conversions,
              },
            };
          }),
        );

        return codesWithStats;
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get user referral codes: ${error instanceof Error ? error.message : String(error)}`,
        }),
    }),

  incrementReferralCodeUsage: (id: string) =>
    Effect.tryPromise({
      try: async () => {
        const [updated] = await db
          .update(referralCodes)
          .set({ usageCount: sql`${referralCodes.usageCount} + 1` })
          .where(eq(referralCodes.id, id))
          .returning();

        if (!updated) {
          throw new Error("Not found");
        }
      },
      catch: (error) => {
        if (error instanceof Error && error.message === "Not found") {
          return new NotFoundError({ message: `Referral code ${id} not found` });
        }
        return new DatabaseError({
          message: `Failed to increment referral code usage: ${error instanceof Error ? error.message : String(error)}`,
        });
      },
    }),

  deactivateReferralCode: (id: string) =>
    Effect.tryPromise({
      try: async () => {
        const [updated] = await db
          .update(referralCodes)
          .set({ isActive: false })
          .where(eq(referralCodes.id, id))
          .returning();

        if (!updated) {
          throw new Error("Not found");
        }
      },
      catch: (error) => {
        if (error instanceof Error && error.message === "Not found") {
          return new NotFoundError({ message: `Referral code ${id} not found` });
        }
        return new DatabaseError({
          message: `Failed to deactivate referral code: ${error instanceof Error ? error.message : String(error)}`,
        });
      },
    }),

  // -------------------------------------------------------------------------
  // Referrals
  // -------------------------------------------------------------------------

  createReferral: (data: NewReferral) =>
    Effect.tryPromise({
      try: async () => {
        // Check for duplicate
        const [existing] = await db
          .select()
          .from(referrals)
          .where(eq(referrals.referredEmail, data.referredEmail.toLowerCase()));

        if (existing) {
          throw { type: "duplicate", email: data.referredEmail };
        }

        const [referral] = await db
          .insert(referrals)
          .values({
            ...data,
            referredEmail: data.referredEmail.toLowerCase(),
          })
          .returning();

        return referral;
      },
      catch: (error) => {
        if (typeof error === "object" && error !== null && "type" in error) {
          const err = error as { type: string; email: string };
          if (err.type === "duplicate") {
            return new DuplicateReferralError(err.email);
          }
        }
        return new DatabaseError({
          message: `Failed to create referral: ${error instanceof Error ? error.message : String(error)}`,
        });
      },
    }),

  getReferral: (id: string) =>
    Effect.tryPromise({
      try: async () => {
        const [referral] = await db.select().from(referrals).where(eq(referrals.id, id));
        if (!referral) {
          throw new Error("Not found");
        }
        return referral;
      },
      catch: (error) => {
        if (error instanceof Error && error.message === "Not found") {
          return new NotFoundError({ message: `Referral ${id} not found` });
        }
        return new DatabaseError({
          message: `Failed to get referral: ${error instanceof Error ? error.message : String(error)}`,
        });
      },
    }),

  getReferralByEmail: (email: string) =>
    Effect.tryPromise({
      try: async () => {
        const [referral] = await db
          .select()
          .from(referrals)
          .where(eq(referrals.referredEmail, email.toLowerCase()));

        return referral ? Option.some(referral) : Option.none();
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get referral by email: ${error instanceof Error ? error.message : String(error)}`,
        }),
    }),

  getUserReferrals: (userId: string) =>
    Effect.tryPromise({
      try: async () => {
        const userReferrals = await db
          .select({
            referral: referrals,
            referredUser: {
              id: users.id,
              name: users.name,
              email: users.email,
              image: users.image,
            },
          })
          .from(referrals)
          .leftJoin(users, eq(referrals.referredUserId, users.id))
          .where(eq(referrals.referrerId, userId))
          .orderBy(desc(referrals.createdAt));

        return userReferrals.map(({ referral, referredUser }) => ({
          ...referral,
          referredUser,
        }));
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get user referrals: ${error instanceof Error ? error.message : String(error)}`,
        }),
    }),

  updateReferralStatus: (id: string, status: Referral["status"], additionalData?: Partial<Referral>) =>
    Effect.tryPromise({
      try: async () => {
        const updateData: Partial<Referral> = {
          status,
          updatedAt: new Date(),
          ...additionalData,
        };

        if (status === "signed_up") {
          updateData.signedUpAt = new Date();
        } else if (status === "converted") {
          updateData.convertedAt = new Date();
        }

        const [updated] = await db
          .update(referrals)
          .set(updateData)
          .where(eq(referrals.id, id))
          .returning();

        if (!updated) {
          throw new Error("Not found");
        }

        return updated;
      },
      catch: (error) => {
        if (error instanceof Error && error.message === "Not found") {
          return new NotFoundError({ message: `Referral ${id} not found` });
        }
        return new DatabaseError({
          message: `Failed to update referral status: ${error instanceof Error ? error.message : String(error)}`,
        });
      },
    }),

  getReferralStats: (userId: string) =>
    Effect.tryPromise({
      try: async () => {
        const userReferrals = await db
          .select()
          .from(referrals)
          .where(eq(referrals.referrerId, userId));

        const rewards = await db
          .select()
          .from(referralRewards)
          .where(eq(referralRewards.userId, userId));

        const totalEarnings = rewards
          .filter((r) => r.status === "awarded" || r.status === "claimed")
          .reduce((sum, r) => sum + (r.amount || 0), 0);

        const pendingRewards = rewards
          .filter((r) => r.status === "pending")
          .reduce((sum, r) => sum + (r.amount || 0), 0);

        return {
          totalReferrals: userReferrals.length,
          pendingReferrals: userReferrals.filter((r) => r.status === "pending").length,
          convertedReferrals: userReferrals.filter((r) => r.status === "converted").length,
          totalEarnings,
          pendingRewards,
        };
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get referral stats: ${error instanceof Error ? error.message : String(error)}`,
        }),
    }),

  // -------------------------------------------------------------------------
  // Rewards
  // -------------------------------------------------------------------------

  createReward: (data: NewReferralReward) =>
    Effect.tryPromise({
      try: async () => {
        const [reward] = await db.insert(referralRewards).values(data).returning();
        return reward;
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to create reward: ${error instanceof Error ? error.message : String(error)}`,
        }),
    }),

  getUserRewards: (userId: string) =>
    Effect.tryPromise({
      try: async () => {
        const rewards = await db
          .select()
          .from(referralRewards)
          .where(eq(referralRewards.userId, userId))
          .orderBy(desc(referralRewards.createdAt));

        return rewards;
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get user rewards: ${error instanceof Error ? error.message : String(error)}`,
        }),
    }),

  getPendingRewards: (userId: string) =>
    Effect.tryPromise({
      try: async () => {
        const rewards = await db
          .select()
          .from(referralRewards)
          .where(
            and(
              eq(referralRewards.userId, userId),
              eq(referralRewards.status, "awarded"),
              or(isNull(referralRewards.expiresAt), lt(new Date(), referralRewards.expiresAt)),
            ),
          )
          .orderBy(desc(referralRewards.createdAt));

        return rewards;
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get pending rewards: ${error instanceof Error ? error.message : String(error)}`,
        }),
    }),

  claimReward: (rewardId: string, userId: string) =>
    Effect.tryPromise({
      try: async () => {
        const [reward] = await db
          .update(referralRewards)
          .set({
            status: "claimed",
            claimedAt: new Date(),
          })
          .where(
            and(
              eq(referralRewards.id, rewardId),
              eq(referralRewards.userId, userId),
              eq(referralRewards.status, "awarded"),
            ),
          )
          .returning();

        if (!reward) {
          throw new Error("Not found");
        }

        return reward;
      },
      catch: (error) => {
        if (error instanceof Error && error.message === "Not found") {
          return new NotFoundError({ message: `Reward ${rewardId} not found or not claimable` });
        }
        return new DatabaseError({
          message: `Failed to claim reward: ${error instanceof Error ? error.message : String(error)}`,
        });
      },
    }),

  // -------------------------------------------------------------------------
  // Programs
  // -------------------------------------------------------------------------

  getActiveProgram: () =>
    Effect.tryPromise({
      try: async () => {
        const now = new Date();
        const [program] = await db
          .select()
          .from(referralPrograms)
          .where(
            and(
              eq(referralPrograms.isActive, true),
              lt(referralPrograms.validFrom, now),
              or(isNull(referralPrograms.validUntil), lt(now, referralPrograms.validUntil)),
            ),
          )
          .orderBy(desc(referralPrograms.createdAt))
          .limit(1);

        return program ? Option.some(program) : Option.none();
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get active program: ${error instanceof Error ? error.message : String(error)}`,
        }),
    }),

  getPrograms: () =>
    Effect.tryPromise({
      try: async () => {
        const programs = await db
          .select()
          .from(referralPrograms)
          .orderBy(desc(referralPrograms.createdAt));

        return programs;
      },
      catch: (error) =>
        new DatabaseError({
          message: `Failed to get programs: ${error instanceof Error ? error.message : String(error)}`,
        }),
    }),
});

// =============================================================================
// Service Layer
// =============================================================================

export const ReferralRepositoryLive = Layer.effect(
  ReferralRepository,
  Effect.gen(function* () {
    const database = yield* Database;
    return make(database.db);
  }),
);

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Generate a unique referral code for a user
 */
export const generateReferralCode = (userName: string): string => {
  const prefix = userName
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 4);
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix || "USER"}${suffix}`;
};
