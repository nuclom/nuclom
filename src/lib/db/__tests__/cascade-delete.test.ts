/**
 * Cascade Delete Tests
 *
 * These tests verify that cascade delete constraints work correctly
 * to maintain data integrity when organizations or users are deleted.
 *
 * Test Categories:
 * 1. Organization deletion - should cascade to all org content
 * 2. User deletion - should cascade user-specific data, SET NULL for content
 * 3. Video deletion - should cascade to comments, progress, etc.
 * 4. Channel/Collection deletion - should SET NULL on videos
 *
 * To run these tests, install vitest: pnpm add -D vitest
 * Then run: pnpm vitest src/lib/db/__tests__/cascade-delete.test.ts
 */

import { eq } from "drizzle-orm";
// @ts-expect-error - vitest may not be installed
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "../index";
import {
  channels,
  collections,
  comments,
  invitations,
  invoices,
  members,
  notifications,
  organizations,
  paymentMethods,
  plans,
  seriesProgress,
  seriesVideos,
  subscriptions,
  usage,
  users,
  videoProgresses,
  videos,
} from "../schema";

// Test data IDs
const testIds = {
  userId: "test-user-cascade-001",
  userId2: "test-user-cascade-002",
  orgId: "test-org-cascade-001",
  videoId: "test-video-cascade-001",
  videoId2: "test-video-cascade-002",
  channelId: "test-channel-cascade-001",
  collectionId: "test-collection-cascade-001",
  commentId: "test-comment-cascade-001",
  planId: "test-plan-cascade-001",
};

describe("Cascade Delete Tests", () => {
  // Setup test data before each test
  beforeEach(async () => {
    // Create test user
    await db.insert(users).values({
      id: testIds.userId,
      name: "Test User",
      email: "cascade-test@example.com",
      emailVerified: true,
    });

    await db.insert(users).values({
      id: testIds.userId2,
      name: "Test User 2",
      email: "cascade-test-2@example.com",
      emailVerified: true,
    });

    // Create test organization
    await db.insert(organizations).values({
      id: testIds.orgId,
      name: "Test Organization",
      slug: "test-org-cascade",
      createdAt: new Date(),
    });

    // Create membership
    await db.insert(members).values({
      id: crypto.randomUUID(),
      organizationId: testIds.orgId,
      userId: testIds.userId,
      role: "owner",
      createdAt: new Date(),
    });

    // Create test channel
    await db.insert(channels).values({
      id: testIds.channelId,
      name: "Test Channel",
      organizationId: testIds.orgId,
    });

    // Create test collection
    await db.insert(collections).values({
      id: testIds.collectionId,
      name: "Test Collection",
      organizationId: testIds.orgId,
      createdById: testIds.userId,
    });

    // Create test plan for billing tests
    await db.insert(plans).values({
      id: testIds.planId,
      name: "Test Plan",
      priceMonthly: 0,
      limits: { storage: 1000000, videos: 100, members: 10, bandwidth: 1000000 },
      features: { aiInsights: true, customBranding: false, sso: false, prioritySupport: false, apiAccess: false },
    });
  });

  // Cleanup after each test
  afterEach(async () => {
    // Clean up in reverse order of dependencies
    await db.delete(seriesProgress).where(eq(seriesProgress.seriesId, testIds.collectionId));
    await db.delete(seriesVideos).where(eq(seriesVideos.seriesId, testIds.collectionId));
    await db.delete(videoProgresses).where(eq(videoProgresses.videoId, testIds.videoId));
    await db.delete(comments).where(eq(comments.videoId, testIds.videoId));
    await db.delete(videos).where(eq(videos.organizationId, testIds.orgId));
    await db.delete(channels).where(eq(channels.organizationId, testIds.orgId));
    await db.delete(collections).where(eq(collections.organizationId, testIds.orgId));
    await db.delete(notifications).where(eq(notifications.userId, testIds.userId));
    await db.delete(paymentMethods).where(eq(paymentMethods.organizationId, testIds.orgId));
    await db.delete(invoices).where(eq(invoices.organizationId, testIds.orgId));
    await db.delete(usage).where(eq(usage.organizationId, testIds.orgId));
    await db.delete(subscriptions).where(eq(subscriptions.organizationId, testIds.orgId));
    await db.delete(invitations).where(eq(invitations.organizationId, testIds.orgId));
    await db.delete(members).where(eq(members.organizationId, testIds.orgId));
    await db.delete(organizations).where(eq(organizations.id, testIds.orgId));
    await db.delete(users).where(eq(users.id, testIds.userId));
    await db.delete(users).where(eq(users.id, testIds.userId2));
    await db.delete(plans).where(eq(plans.id, testIds.planId));
  });

  describe("Organization Deletion Cascade", () => {
    it("should cascade delete all org content when organization is deleted", async () => {
      // Create video in org
      await db.insert(videos).values({
        id: testIds.videoId,
        title: "Test Video",
        duration: "10:00",
        organizationId: testIds.orgId,
        authorId: testIds.userId,
      });

      // Create comment on video
      await db.insert(comments).values({
        id: testIds.commentId,
        content: "Test comment",
        videoId: testIds.videoId,
        authorId: testIds.userId,
      });

      // Create subscription
      await db.insert(subscriptions).values({
        id: crypto.randomUUID(),
        organizationId: testIds.orgId,
        planId: testIds.planId,
        status: "active",
      });

      // Verify data exists before deletion
      const videosBefore = await db.select().from(videos).where(eq(videos.organizationId, testIds.orgId));
      expect(videosBefore.length).toBe(1);

      const channelsBefore = await db.select().from(channels).where(eq(channels.organizationId, testIds.orgId));
      expect(channelsBefore.length).toBe(1);

      const membersBefore = await db.select().from(members).where(eq(members.organizationId, testIds.orgId));
      expect(membersBefore.length).toBe(1);

      // Delete organization
      await db.delete(organizations).where(eq(organizations.id, testIds.orgId));

      // Verify cascade deletion
      const videosAfter = await db.select().from(videos).where(eq(videos.organizationId, testIds.orgId));
      expect(videosAfter.length).toBe(0);

      const channelsAfter = await db.select().from(channels).where(eq(channels.organizationId, testIds.orgId));
      expect(channelsAfter.length).toBe(0);

      const collectionsAfter = await db.select().from(collections).where(eq(collections.organizationId, testIds.orgId));
      expect(collectionsAfter.length).toBe(0);

      const membersAfter = await db.select().from(members).where(eq(members.organizationId, testIds.orgId));
      expect(membersAfter.length).toBe(0);

      const subscriptionsAfter = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.organizationId, testIds.orgId));
      expect(subscriptionsAfter.length).toBe(0);

      // Comments should also be deleted (cascade through videos)
      const commentsAfter = await db.select().from(comments).where(eq(comments.id, testIds.commentId));
      expect(commentsAfter.length).toBe(0);
    });

    it("should cascade delete invitations when organization is deleted", async () => {
      // Create invitation
      await db.insert(invitations).values({
        id: crypto.randomUUID(),
        organizationId: testIds.orgId,
        email: "invite@test.com",
        role: "member",
        status: "pending",
        expiresAt: new Date(Date.now() + 86400000),
        inviterId: testIds.userId,
      });

      const invitationsBefore = await db
        .select()
        .from(invitations)
        .where(eq(invitations.organizationId, testIds.orgId));
      expect(invitationsBefore.length).toBe(1);

      // Delete organization
      await db.delete(organizations).where(eq(organizations.id, testIds.orgId));

      const invitationsAfter = await db.select().from(invitations).where(eq(invitations.organizationId, testIds.orgId));
      expect(invitationsAfter.length).toBe(0);
    });

    it("should cascade delete billing data when organization is deleted", async () => {
      // Create billing data
      await db.insert(subscriptions).values({
        id: crypto.randomUUID(),
        organizationId: testIds.orgId,
        planId: testIds.planId,
        status: "active",
      });

      await db.insert(usage).values({
        id: crypto.randomUUID(),
        organizationId: testIds.orgId,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 86400000 * 30),
      });

      await db.insert(invoices).values({
        id: crypto.randomUUID(),
        organizationId: testIds.orgId,
        amount: 1000,
        status: "paid",
      });

      await db.insert(paymentMethods).values({
        id: crypto.randomUUID(),
        organizationId: testIds.orgId,
        stripePaymentMethodId: "pm_test_123",
        type: "card",
      });

      // Delete organization
      await db.delete(organizations).where(eq(organizations.id, testIds.orgId));

      // Verify all billing data deleted
      const subscriptionsAfter = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.organizationId, testIds.orgId));
      expect(subscriptionsAfter.length).toBe(0);

      const usageAfter = await db.select().from(usage).where(eq(usage.organizationId, testIds.orgId));
      expect(usageAfter.length).toBe(0);

      const invoicesAfter = await db.select().from(invoices).where(eq(invoices.organizationId, testIds.orgId));
      expect(invoicesAfter.length).toBe(0);

      const paymentMethodsAfter = await db
        .select()
        .from(paymentMethods)
        .where(eq(paymentMethods.organizationId, testIds.orgId));
      expect(paymentMethodsAfter.length).toBe(0);
    });
  });

  describe("User Deletion Handling", () => {
    it("should SET NULL on video.authorId when user is deleted", async () => {
      // Create video with author
      await db.insert(videos).values({
        id: testIds.videoId,
        title: "Test Video",
        duration: "10:00",
        organizationId: testIds.orgId,
        authorId: testIds.userId,
      });

      // Verify author is set
      const videoBefore = await db.select().from(videos).where(eq(videos.id, testIds.videoId));
      expect(videoBefore[0].authorId).toBe(testIds.userId);

      // Delete user
      await db.delete(users).where(eq(users.id, testIds.userId));

      // Verify video still exists but authorId is null
      const videoAfter = await db.select().from(videos).where(eq(videos.id, testIds.videoId));
      expect(videoAfter.length).toBe(1);
      expect(videoAfter[0].authorId).toBeNull();
      expect(videoAfter[0].title).toBe("Test Video"); // Video content preserved
    });

    it("should SET NULL on collection.createdById when user is deleted", async () => {
      // Verify createdById is set
      const collectionBefore = await db.select().from(collections).where(eq(collections.id, testIds.collectionId));
      expect(collectionBefore[0].createdById).toBe(testIds.userId);

      // Delete user
      await db.delete(users).where(eq(users.id, testIds.userId));

      // Verify collection still exists but createdById is null
      const collectionAfter = await db.select().from(collections).where(eq(collections.id, testIds.collectionId));
      expect(collectionAfter.length).toBe(1);
      expect(collectionAfter[0].createdById).toBeNull();
    });

    it("should cascade delete user's comments when user is deleted", async () => {
      // Create video first
      await db.insert(videos).values({
        id: testIds.videoId,
        title: "Test Video",
        duration: "10:00",
        organizationId: testIds.orgId,
        authorId: testIds.userId2, // Different author
      });

      // Create comment by user
      await db.insert(comments).values({
        id: testIds.commentId,
        content: "Test comment",
        videoId: testIds.videoId,
        authorId: testIds.userId,
      });

      const commentsBefore = await db.select().from(comments).where(eq(comments.authorId, testIds.userId));
      expect(commentsBefore.length).toBe(1);

      // Delete user
      await db.delete(users).where(eq(users.id, testIds.userId));

      // Comments should be deleted
      const commentsAfter = await db.select().from(comments).where(eq(comments.id, testIds.commentId));
      expect(commentsAfter.length).toBe(0);
    });

    it("should cascade delete user's video progress when user is deleted", async () => {
      // Create video
      await db.insert(videos).values({
        id: testIds.videoId,
        title: "Test Video",
        duration: "10:00",
        organizationId: testIds.orgId,
        authorId: testIds.userId2,
      });

      // Create progress record
      await db.insert(videoProgresses).values({
        id: crypto.randomUUID(),
        userId: testIds.userId,
        videoId: testIds.videoId,
        currentTime: "05:00",
      });

      const progressBefore = await db.select().from(videoProgresses).where(eq(videoProgresses.userId, testIds.userId));
      expect(progressBefore.length).toBe(1);

      // Delete user
      await db.delete(users).where(eq(users.id, testIds.userId));

      // Progress should be deleted
      const progressAfter = await db.select().from(videoProgresses).where(eq(videoProgresses.userId, testIds.userId));
      expect(progressAfter.length).toBe(0);
    });

    it("should cascade delete user's series progress when user is deleted", async () => {
      // Create series progress
      await db.insert(seriesProgress).values({
        id: crypto.randomUUID(),
        userId: testIds.userId,
        seriesId: testIds.collectionId,
        lastPosition: 0,
      });

      const progressBefore = await db.select().from(seriesProgress).where(eq(seriesProgress.userId, testIds.userId));
      expect(progressBefore.length).toBe(1);

      // Delete user
      await db.delete(users).where(eq(users.id, testIds.userId));

      // Series progress should be deleted
      const progressAfter = await db.select().from(seriesProgress).where(eq(seriesProgress.userId, testIds.userId));
      expect(progressAfter.length).toBe(0);
    });

    it("should cascade delete user's notifications when user is deleted", async () => {
      // Create notification
      await db.insert(notifications).values({
        id: crypto.randomUUID(),
        userId: testIds.userId,
        type: "comment_reply",
        title: "Test notification",
      });

      const notificationsBefore = await db.select().from(notifications).where(eq(notifications.userId, testIds.userId));
      expect(notificationsBefore.length).toBe(1);

      // Delete user
      await db.delete(users).where(eq(users.id, testIds.userId));

      // Notifications should be deleted
      const notificationsAfter = await db.select().from(notifications).where(eq(notifications.userId, testIds.userId));
      expect(notificationsAfter.length).toBe(0);
    });
  });

  describe("Video Deletion Cascade", () => {
    beforeEach(async () => {
      // Create video for these tests
      await db.insert(videos).values({
        id: testIds.videoId,
        title: "Test Video",
        duration: "10:00",
        organizationId: testIds.orgId,
        authorId: testIds.userId,
      });
    });

    it("should cascade delete comments when video is deleted", async () => {
      // Create comment
      await db.insert(comments).values({
        id: testIds.commentId,
        content: "Test comment",
        videoId: testIds.videoId,
        authorId: testIds.userId,
      });

      const commentsBefore = await db.select().from(comments).where(eq(comments.videoId, testIds.videoId));
      expect(commentsBefore.length).toBe(1);

      // Delete video
      await db.delete(videos).where(eq(videos.id, testIds.videoId));

      // Comments should be deleted
      const commentsAfter = await db.select().from(comments).where(eq(comments.videoId, testIds.videoId));
      expect(commentsAfter.length).toBe(0);
    });

    it("should cascade delete video progress when video is deleted", async () => {
      // Create progress
      await db.insert(videoProgresses).values({
        id: crypto.randomUUID(),
        userId: testIds.userId,
        videoId: testIds.videoId,
        currentTime: "05:00",
      });

      const progressBefore = await db
        .select()
        .from(videoProgresses)
        .where(eq(videoProgresses.videoId, testIds.videoId));
      expect(progressBefore.length).toBe(1);

      // Delete video
      await db.delete(videos).where(eq(videos.id, testIds.videoId));

      // Progress should be deleted
      const progressAfter = await db.select().from(videoProgresses).where(eq(videoProgresses.videoId, testIds.videoId));
      expect(progressAfter.length).toBe(0);
    });

    it("should cascade delete series video entries when video is deleted", async () => {
      // Add video to series
      await db.insert(seriesVideos).values({
        id: crypto.randomUUID(),
        seriesId: testIds.collectionId,
        videoId: testIds.videoId,
        position: 0,
      });

      const seriesVideosBefore = await db.select().from(seriesVideos).where(eq(seriesVideos.videoId, testIds.videoId));
      expect(seriesVideosBefore.length).toBe(1);

      // Delete video
      await db.delete(videos).where(eq(videos.id, testIds.videoId));

      // Series video entry should be deleted
      const seriesVideosAfter = await db.select().from(seriesVideos).where(eq(seriesVideos.videoId, testIds.videoId));
      expect(seriesVideosAfter.length).toBe(0);
    });

    it("should SET NULL on series progress lastVideoId when video is deleted", async () => {
      // Create series progress with lastVideoId
      await db.insert(seriesProgress).values({
        id: crypto.randomUUID(),
        userId: testIds.userId,
        seriesId: testIds.collectionId,
        lastVideoId: testIds.videoId,
        lastPosition: 0,
      });

      const progressBefore = await db
        .select()
        .from(seriesProgress)
        .where(eq(seriesProgress.seriesId, testIds.collectionId));
      expect(progressBefore[0].lastVideoId).toBe(testIds.videoId);

      // Delete video
      await db.delete(videos).where(eq(videos.id, testIds.videoId));

      // Series progress should remain but lastVideoId should be null
      const progressAfter = await db
        .select()
        .from(seriesProgress)
        .where(eq(seriesProgress.seriesId, testIds.collectionId));
      expect(progressAfter.length).toBe(1);
      expect(progressAfter[0].lastVideoId).toBeNull();
    });
  });

  describe("Channel Deletion Handling", () => {
    it("should SET NULL on video.channelId when channel is deleted", async () => {
      // Create video in channel
      await db.insert(videos).values({
        id: testIds.videoId,
        title: "Test Video",
        duration: "10:00",
        organizationId: testIds.orgId,
        authorId: testIds.userId,
        channelId: testIds.channelId,
      });

      const videoBefore = await db.select().from(videos).where(eq(videos.id, testIds.videoId));
      expect(videoBefore[0].channelId).toBe(testIds.channelId);

      // Delete channel
      await db.delete(channels).where(eq(channels.id, testIds.channelId));

      // Video should remain but channelId should be null
      const videoAfter = await db.select().from(videos).where(eq(videos.id, testIds.videoId));
      expect(videoAfter.length).toBe(1);
      expect(videoAfter[0].channelId).toBeNull();
    });
  });

  describe("Collection Deletion Cascade", () => {
    it("should cascade delete series videos and progress when collection is deleted", async () => {
      // Create video
      await db.insert(videos).values({
        id: testIds.videoId,
        title: "Test Video",
        duration: "10:00",
        organizationId: testIds.orgId,
        authorId: testIds.userId,
      });

      // Add video to series
      await db.insert(seriesVideos).values({
        id: crypto.randomUUID(),
        seriesId: testIds.collectionId,
        videoId: testIds.videoId,
        position: 0,
      });

      // Create series progress
      await db.insert(seriesProgress).values({
        id: crypto.randomUUID(),
        userId: testIds.userId,
        seriesId: testIds.collectionId,
        lastPosition: 0,
      });

      const seriesVideosBefore = await db
        .select()
        .from(seriesVideos)
        .where(eq(seriesVideos.seriesId, testIds.collectionId));
      expect(seriesVideosBefore.length).toBe(1);

      const progressBefore = await db
        .select()
        .from(seriesProgress)
        .where(eq(seriesProgress.seriesId, testIds.collectionId));
      expect(progressBefore.length).toBe(1);

      // Delete collection
      await db.delete(collections).where(eq(collections.id, testIds.collectionId));

      // Series videos and progress should be deleted
      const seriesVideosAfter = await db
        .select()
        .from(seriesVideos)
        .where(eq(seriesVideos.seriesId, testIds.collectionId));
      expect(seriesVideosAfter.length).toBe(0);

      const progressAfter = await db
        .select()
        .from(seriesProgress)
        .where(eq(seriesProgress.seriesId, testIds.collectionId));
      expect(progressAfter.length).toBe(0);

      // But the video should still exist
      const videoAfter = await db.select().from(videos).where(eq(videos.id, testIds.videoId));
      expect(videoAfter.length).toBe(1);
    });

    it("should SET NULL on video.collectionId when collection is deleted", async () => {
      // Create video in collection
      await db.insert(videos).values({
        id: testIds.videoId,
        title: "Test Video",
        duration: "10:00",
        organizationId: testIds.orgId,
        authorId: testIds.userId,
        collectionId: testIds.collectionId,
      });

      const videoBefore = await db.select().from(videos).where(eq(videos.id, testIds.videoId));
      expect(videoBefore[0].collectionId).toBe(testIds.collectionId);

      // Delete collection
      await db.delete(collections).where(eq(collections.id, testIds.collectionId));

      // Video should remain but collectionId should be null
      const videoAfter = await db.select().from(videos).where(eq(videos.id, testIds.videoId));
      expect(videoAfter.length).toBe(1);
      expect(videoAfter[0].collectionId).toBeNull();
    });
  });
});
