import { vi } from "vitest";
import type { User, Video, Organization } from "@/lib/db/schema";
import type { VideoWithAuthor } from "@/lib/types";

/**
 * Creates a mock database object for testing Effect-TS services
 */
export function createMockDatabase() {
  return {
    db: {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockReturnValue([]),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      transaction: vi.fn(),
    },
  };
}

/**
 * Creates a mock user for testing with all required fields from schema
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    image: "/avatar.png",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    emailVerified: true,
    role: "user",
    banned: null,
    banReason: null,
    banExpires: null,
    twoFactorEnabled: null,
    tosAcceptedAt: null,
    tosVersion: null,
    privacyAcceptedAt: null,
    privacyVersion: null,
    marketingConsentAt: null,
    marketingConsent: false,
    deletionRequestedAt: null,
    deletionScheduledFor: null,
    warnedAt: null,
    warningReason: null,
    suspendedUntil: null,
    suspensionReason: null,
    ...overrides,
  };
}

// Omit internal fields from video types (searchVector, soft-delete fields) for testing
type TestVideo = Omit<Video, "searchVector" | "deletedAt" | "retentionUntil">;

/**
 * Creates a mock video for testing with all required fields from schema
 */
export function createMockVideo(overrides: Partial<TestVideo> = {}): TestVideo {
  return {
    id: "video-123",
    title: "Test Video",
    description: "A test video description",
    duration: "10:30",
    thumbnailUrl: "/thumbnail.jpg",
    videoUrl: "/video.mp4",
    authorId: "user-123",
    organizationId: "org-123",
    channelId: null,
    collectionId: null,
    transcript: "Sample transcript text",
    transcriptSegments: [],
    processingStatus: "completed",
    processingError: null,
    aiSummary: "AI generated summary",
    aiTags: ["test", "video"],
    aiActionItems: [],
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  };
}

/**
 * Creates a mock organization for testing with all required fields from schema
 */
export function createMockOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-123",
    name: "Test Organization",
    slug: "test-org",
    logo: "/logo.png",
    createdAt: new Date("2024-01-01"),
    metadata: null,
    ...overrides,
  };
}

/**
 * Creates a mock video with author for testing
 */
export function createMockVideoWithAuthor(
  videoOverrides: Partial<TestVideo> = {},
  userOverrides: Partial<User> = {},
): VideoWithAuthor {
  return {
    ...createMockVideo(videoOverrides),
    author: createMockUser(userOverrides),
  };
}

interface MockSession {
  user: User;
  expires: string;
}

/**
 * Creates a mock session for testing auth
 */
export function createMockSession(overrides: Partial<MockSession> = {}): MockSession {
  return {
    user: createMockUser(),
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

/**
 * Creates a mock AI response for testing AI service
 */
export function createMockAIResponse(text: string) {
  return {
    text,
    usage: { promptTokens: 100, completionTokens: 50 },
  };
}
