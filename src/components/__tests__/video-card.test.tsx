import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VideoCard } from "../video-card";
import type { VideoWithAuthor } from "@/lib/types";

const mockVideo: VideoWithAuthor = {
  id: "video-1",
  title: "Test Video Title",
  description: "Test video description",
  duration: "10:30",
  thumbnailUrl: "/test-thumbnail.jpg",
  videoUrl: "/test-video.mp4",
  authorId: "author-1",
  organizationId: "org-1",
  channelId: null,
  collectionId: null,
  transcript: null,
  aiSummary: null,
  createdAt: new Date("2023-01-01"),
  updatedAt: new Date("2023-01-01"),
  author: {
    id: "author-1",
    name: "John Doe",
    email: "john@example.com",
    emailVerified: true,
    image: "/author-avatar.jpg",
    createdAt: new Date("2023-01-01"),
    updatedAt: new Date("2023-01-01"),
    role: "user" as const,
    banned: false,
    banReason: null,
    banExpires: null,
  },
};

describe("VideoCard", () => {
  it("renders video information correctly", () => {
    render(<VideoCard video={mockVideo} organization="test-org" />);

    expect(screen.getByText("Test Video Title")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("10:30")).toBeInTheDocument();
    expect(screen.getByAltText("Test Video Title")).toBeInTheDocument();
    // The avatar shows initials when image doesn't load in tests
    expect(screen.getByText("J")).toBeInTheDocument();
  });

  it("renders with placeholder thumbnail when thumbnailUrl is null", () => {
    const videoWithoutThumbnail = {
      ...mockVideo,
      thumbnailUrl: null,
    };

    render(<VideoCard video={videoWithoutThumbnail} organization="test-org" />);

    const thumbnailImg = screen.getByAltText("Test Video Title");
    expect(thumbnailImg).toHaveAttribute("src", expect.stringContaining("placeholder.svg"));
  });

  it("renders with placeholder avatar when author image is null", () => {
    const videoWithoutAuthorImage = {
      ...mockVideo,
      author: {
        ...mockVideo.author,
        image: null,
      },
    };

    render(<VideoCard video={videoWithoutAuthorImage} organization="test-org" />);

    // Should show the initial instead of image when no image
    expect(screen.getByText("J")).toBeInTheDocument();
  });

  it("renders author initials when author has no image", () => {
    const videoWithoutAuthorImage = {
      ...mockVideo,
      author: {
        ...mockVideo.author,
        image: null,
      },
    };

    render(<VideoCard video={videoWithoutAuthorImage} organization="test-org" />);

    expect(screen.getByText("J")).toBeInTheDocument(); // First letter of "John Doe"
  });

  it("renders fallback when author name is empty", () => {
    const videoWithoutAuthorName = {
      ...mockVideo,
      author: {
        ...mockVideo.author,
        name: "",
      },
    };

    render(<VideoCard video={videoWithoutAuthorName} organization="test-org" />);

    expect(screen.getByText("A")).toBeInTheDocument(); // Fallback letter
  });

  it("creates correct link URL with organization", () => {
    render(<VideoCard video={mockVideo} organization="test-org" />);

    const linkElement = screen.getByRole("link");
    expect(linkElement).toHaveAttribute("href", "/test-org/videos/video-1");
  });

  it("creates correct link URL with default organization when none provided", () => {
    render(<VideoCard video={mockVideo} />);

    const linkElement = screen.getByRole("link");
    expect(linkElement).toHaveAttribute("href", "/default/videos/video-1");
  });

  it("has proper accessibility attributes", () => {
    render(<VideoCard video={mockVideo} organization="test-org" />);

    const linkElement = screen.getByRole("link");
    expect(linkElement).toHaveClass("group");

    const thumbnailImg = screen.getByAltText("Test Video Title");
    expect(thumbnailImg).toBeInTheDocument();

    // Avatar fallback shows initial
    expect(screen.getByText("J")).toBeInTheDocument();
  });
});
