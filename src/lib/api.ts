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

  async uploadVideo(
    file: File,
    metadata: {
      title: string;
      description?: string;
      workspaceId: string;
      authorId: string;
      channelId?: string;
      seriesId?: string;
    },
    onProgress?: (progress: number) => void,
  ): Promise<{
    videoId: string;
    videoUrl: string;
    thumbnailUrl: string;
    duration: string;
  }> {
    const formData = new FormData();
    formData.append("video", file);
    formData.append("title", metadata.title);
    if (metadata.description) formData.append("description", metadata.description);
    formData.append("workspaceId", metadata.workspaceId);
    formData.append("authorId", metadata.authorId);
    if (metadata.channelId) formData.append("channelId", metadata.channelId);
    if (metadata.seriesId) formData.append("seriesId", metadata.seriesId);

    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress(progress);
          }
        });
      }

      xhr.addEventListener("load", async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            if (response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response.error || "Upload failed"));
            }
          } catch (error) {
            reject(new Error("Invalid response format"));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
            reject(new Error(errorResponse.error || `HTTP ${xhr.status}`));
          } catch {
            reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
          }
        }
      });

      xhr.addEventListener("error", () => {
        reject(new Error("Network error occurred"));
      });

      xhr.addEventListener("timeout", () => {
        reject(new Error("Upload timeout"));
      });

      xhr.open("POST", `${API_BASE_URL}/videos/upload`);
      xhr.timeout = 300000; // 5 minutes timeout
      xhr.send(formData);
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
