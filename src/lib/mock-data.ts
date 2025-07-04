import type { VideoWithAuthor, VideoWithDetails } from "@/lib/types";

// Mock data that simulates what would come from the database
export const mockVideos: VideoWithAuthor[] = [
  {
    id: "1",
    title: "Introducing the Frontend Cloud",
    description: "Learn about the future of frontend development",
    duration: "12:34",
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
    videoUrl: null,
    authorId: "user1",
    workspaceId: "workspace1",
    channelId: null,
    seriesId: null,
    transcript: null,
    aiSummary: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    author: {
      id: "user1",
      email: "vercel@example.com",
      name: "Vercel",
      avatarUrl: "/placeholder.svg?height=36&width=36",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    },
  },
  {
    id: "2",
    title: "Next.js 15: A Deep Dive",
    description: "Exploring the latest features in Next.js 15",
    duration: "45:12",
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
    videoUrl: null,
    authorId: "user2",
    workspaceId: "workspace1",
    channelId: null,
    seriesId: null,
    transcript: null,
    aiSummary: null,
    createdAt: new Date("2024-01-02"),
    updatedAt: new Date("2024-01-02"),
    author: {
      id: "user2",
      email: "lee@example.com",
      name: "Lee Robinson",
      avatarUrl: "/placeholder.svg?height=36&width=36",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    },
  },
  {
    id: "3",
    title: "Design Systems with shadcn/ui",
    description: "Building beautiful UIs with shadcn/ui",
    duration: "28:56",
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
    videoUrl: null,
    authorId: "user3",
    workspaceId: "workspace1",
    channelId: null,
    seriesId: null,
    transcript: null,
    aiSummary: null,
    createdAt: new Date("2024-01-03"),
    updatedAt: new Date("2024-01-03"),
    author: {
      id: "user3",
      email: "shadcn@example.com",
      name: "Shadcn",
      avatarUrl: "/placeholder.svg?height=36&width=36",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    },
  },
  {
    id: "4",
    title: "AI-Powered Development with v0",
    description: "Using AI to accelerate development",
    duration: "18:21",
    thumbnailUrl: "/placeholder.svg?height=180&width=320",
    videoUrl: null,
    authorId: "user1",
    workspaceId: "workspace1",
    channelId: null,
    seriesId: null,
    transcript: null,
    aiSummary: null,
    createdAt: new Date("2024-01-04"),
    updatedAt: new Date("2024-01-04"),
    author: {
      id: "user1",
      email: "vercel@example.com",
      name: "Vercel",
      avatarUrl: "/placeholder.svg?height=36&width=36",
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    },
  },
];

// Mock API functions for development (when database is not available)
export const mockVideoApi = {
  async getVideos(): Promise<{ data: VideoWithAuthor[]; pagination: any }> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return {
      data: mockVideos,
      pagination: {
        page: 1,
        limit: 20,
        total: mockVideos.length,
        totalPages: 1,
      },
    };
  },

  async getVideo(id: string): Promise<VideoWithDetails> {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const video = mockVideos.find((v) => v.id === id);
    if (!video) {
      throw new Error("Video not found");
    }

    return {
      ...video,
      workspace: {
        id: "workspace1",
        name: "My Workspace",
        slug: "my-workspace",
        description: "Default workspace",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-01"),
      },
      channel: null,
      series: null,
      comments: [],
    };
  },
};
