import { v4 as uuidv4 } from "uuid";
import StorageService from "./storage";

export interface VideoInfo {
  duration: string;
  width: number;
  height: number;
  format: string;
  size: number;
}

export interface ProcessingResult {
  videoUrl: string;
  thumbnailUrl: string;
  duration: string;
  info: VideoInfo;
}

export interface ProcessingProgress {
  stage: "uploading" | "processing" | "generating_thumbnail" | "complete";
  progress: number; // 0-100
  message: string;
}

export class VideoProcessor {
  /**
   * Get video metadata without full processing
   * This is a simplified version - in production you'd use ffmpeg or similar
   */
  static async getVideoInfo(buffer: Buffer): Promise<VideoInfo> {
    // For now, return mock data based on file size
    // In production, you'd use ffmpeg or a media processing library
    const size = buffer.length;
    const estimatedDuration = Math.max(10, Math.floor(size / (1024 * 1024)) * 60); // Rough estimate

    return {
      duration: this.formatDuration(estimatedDuration),
      width: 1920,
      height: 1080,
      format: "mp4",
      size,
    };
  }

  /**
   * Process video: upload original, generate thumbnail, and optionally transcode
   */
  static async processVideo(
    buffer: Buffer,
    filename: string,
    organizationId: string,
    onProgress?: (progress: ProcessingProgress) => void,
  ): Promise<ProcessingResult> {
    const videoId = uuidv4();

    try {
      // Stage 1: Upload original video
      onProgress?.({
        stage: "uploading",
        progress: 10,
        message: "Uploading video file...",
      });

      const videoKey = StorageService.generateFileKey(organizationId, `${videoId}-${filename}`, "video");
      const contentType = this.getContentType(filename);

      const uploadResult = await StorageService.uploadLargeFile(
        buffer,
        videoKey,
        {
          contentType,
          metadata: {
            originalFilename: filename,
            videoId,
            organizationId,
          },
        },
        (uploadProgress) => {
          const progressPercent = Math.floor((uploadProgress.loaded / uploadProgress.total) * 30) + 10;
          onProgress?.({
            stage: "uploading",
            progress: progressPercent,
            message: `Uploading... ${Math.floor((uploadProgress.loaded / uploadProgress.total) * 100)}%`,
          });
        },
      );

      onProgress?.({
        stage: "processing",
        progress: 50,
        message: "Processing video metadata...",
      });

      // Stage 2: Get video information
      const videoInfo = await this.getVideoInfo(buffer);

      onProgress?.({
        stage: "generating_thumbnail",
        progress: 70,
        message: "Generating thumbnail...",
      });

      // Stage 3: Generate thumbnail
      const thumbnailBuffer = await this.generateThumbnail(buffer, filename);
      const thumbnailKey = StorageService.generateFileKey(organizationId, `${videoId}-thumbnail.jpg`, "thumbnail");

      const thumbnailResult = await StorageService.uploadFile(thumbnailBuffer, thumbnailKey, {
        contentType: "image/jpeg",
        metadata: {
          videoId,
          organizationId,
          type: "thumbnail",
        },
      });

      onProgress?.({
        stage: "complete",
        progress: 100,
        message: "Video processing complete!",
      });

      return {
        videoUrl: uploadResult.url,
        thumbnailUrl: thumbnailResult.url,
        duration: videoInfo.duration,
        info: videoInfo,
      };
    } catch (error) {
      console.error("Error processing video:", error);
      throw new Error(`Video processing failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Generate a thumbnail from video
   * This is a mock implementation - in production you'd use ffmpeg
   */
  private static async generateThumbnail(buffer: Buffer, filename: string): Promise<Buffer> {
    // Mock thumbnail generation - create a simple colored rectangle
    // In production, you'd use ffmpeg to extract a frame from the video

    // For now, return a minimal JPEG header for a 320x180 placeholder
    const width = 320;
    const height = 180;

    // This is a very basic placeholder - you'd use a proper image library or ffmpeg
    const placeholder = this.createPlaceholderImage(width, height, filename);
    return placeholder;
  }

  /**
   * Create a placeholder thumbnail image
   */
  private static createPlaceholderImage(width: number, height: number, filename: string): Buffer {
    // Create a minimal JPEG-like buffer for a placeholder
    // In production, you'd use a proper image library like Sharp or Canvas

    // Simple base64 encoded 1x1 pixel JPEG that we'll expand
    const base64Jpeg =
      "/9j/4AAQSkZJRgABAQEAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=";

    // For a real implementation, you'd generate an actual thumbnail image
    // This is just a placeholder to demonstrate the structure
    return Buffer.from(base64Jpeg, "base64");
  }

  /**
   * Format duration from seconds to HH:MM:SS or MM:SS
   */
  private static formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  /**
   * Get content type based on file extension
   */
  private static getContentType(filename: string): string {
    const ext = filename.toLowerCase().split(".").pop();
    const contentTypes: Record<string, string> = {
      mp4: "video/mp4",
      mov: "video/quicktime",
      avi: "video/x-msvideo",
      mkv: "video/x-matroska",
      webm: "video/webm",
      flv: "video/x-flv",
      wmv: "video/x-ms-wmv",
    };

    return contentTypes[ext || ""] || "video/mp4";
  }

  /**
   * Check if file type is supported
   */
  static isSupportedVideoFormat(filename: string): boolean {
    const ext = filename.toLowerCase().split(".").pop();
    const supportedFormats = ["mp4", "mov", "avi", "mkv", "webm", "flv", "wmv"];
    return supportedFormats.includes(ext || "");
  }

  /**
   * Get maximum file size allowed (in bytes)
   */
  static getMaxFileSize(): number {
    // 500MB limit
    return 500 * 1024 * 1024;
  }
}

export default VideoProcessor;
