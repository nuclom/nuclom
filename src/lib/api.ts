import type {
  ApiResponse,
  PaginatedResponse,
  VideoWithAuthor,
  VideoWithDetails,
} from "@/lib/types";

const API_BASE_URL = "/api";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      `HTTP error! status: ${response.status}`,
    );
  }

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    throw new Error(data.error || "API request failed");
  }

  return data.data as T;
}

// Video API functions
export const videoApi = {
  async getVideos(
    params: {
      workspaceId?: string;
      channelId?: string;
      seriesId?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<PaginatedResponse<VideoWithAuthor>> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    return fetchApi(`/videos?${searchParams.toString()}`);
  },

  async getVideo(id: string): Promise<VideoWithDetails> {
    return fetchApi(`/videos/${id}`);
  },

  async createVideo(data: {
    title: string;
    description?: string;
    duration: string;
    thumbnailUrl?: string;
    videoUrl?: string;
    authorId: string;
    workspaceId: string;
    channelId?: string;
    seriesId?: string;
  }): Promise<VideoWithDetails> {
    return fetchApi("/videos", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateVideo(
    id: string,
    data: Partial<{
      title: string;
      description: string;
      duration: string;
      thumbnailUrl: string;
      videoUrl: string;
      channelId: string;
      seriesId: string;
    }>,
  ): Promise<VideoWithDetails> {
    return fetchApi(`/videos/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteVideo(id: string): Promise<void> {
    return fetchApi(`/videos/${id}`, {
      method: "DELETE",
    });
  },
};

// Workspace API functions
export const workspaceApi = {
  async getWorkspaces(userId?: string) {
    const searchParams = new URLSearchParams();
    if (userId) {
      searchParams.append("userId", userId);
    }

    return fetchApi(`/workspaces?${searchParams.toString()}`);
  },

  async getWorkspace(id: string) {
    return fetchApi(`/workspaces/${id}`);
  },

  async createWorkspace(data: {
    name: string;
    slug: string;
    description?: string;
    ownerId: string;
  }) {
    return fetchApi("/workspaces", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

// Error handling utility
export { ApiError };
