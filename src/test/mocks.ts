import { vi } from "vitest";

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
 * Creates a mock user for testing
 */
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user-123",
    email: "test@example.com",
    name: "Test User",
    image: "/avatar.png",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    emailVerified: true,
    role: "user",
    banned: false,
    banReason: null,
    banExpires: null,
    twoFactorEnabled: null,
    ...overrides,
  };
}

interface MockUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  emailVerified: boolean;
  role: "user" | "admin";
  banned: boolean;
  banReason: string | null;
  banExpires: Date | null;
  twoFactorEnabled: boolean | null;
}

/**
 * Creates a mock video for testing
 */
export function createMockVideo(overrides: Partial<MockVideo> = {}): MockVideo {
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

type MockActionItem = {
  text: string;
  timestamp?: number;
  priority?: "high" | "medium" | "low";
};

type MockTranscriptSegment = {
  startTime: number;
  endTime: number;
  text: string;
  confidence?: number;
};

interface MockVideo {
  id: string;
  title: string;
  description: string | null;
  duration: string;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  authorId: string;
  organizationId: string;
  channelId: string | null;
  collectionId: string | null;
  transcript: string | null;
  transcriptSegments: MockTranscriptSegment[];
  processingStatus: "pending" | "transcribing" | "analyzing" | "completed" | "failed";
  processingError: string | null;
  aiSummary: string | null;
  aiTags: string[] | null;
  aiActionItems: MockActionItem[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Creates a mock organization for testing
 */
export function createMockOrganization(overrides: Partial<MockOrganization> = {}): MockOrganization {
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

interface MockOrganization {
  id: string;
  name: string;
  slug: string | null;
  logo: string | null;
  createdAt: Date;
  metadata: unknown;
}

/**
 * Creates a mock video with author for testing
 */
export function createMockVideoWithAuthor(
  videoOverrides: Partial<MockVideo> = {},
  userOverrides: Partial<MockUser> = {},
) {
  return {
    ...createMockVideo(videoOverrides),
    author: createMockUser(userOverrides),
  };
}

/**
 * Creates a mock session for testing auth
 */
export function createMockSession(overrides: Partial<MockSession> = {}) {
  return {
    user: createMockUser(),
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

interface MockSession {
  user: MockUser;
  expires: string;
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
