import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createMockVideoWithAuthor } from "@/test/mocks";
import { VideoCard } from "./video-card";

describe("VideoCard Component", () => {
  it("should render video title", () => {
    const video = createMockVideoWithAuthor({ title: "My Test Video" });

    render(<VideoCard video={video} />);

    expect(screen.getByText("My Test Video")).toBeInTheDocument();
  });

  it("should render author name", () => {
    const video = createMockVideoWithAuthor({}, { name: "John Doe" });

    render(<VideoCard video={video} />);

    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("should render video duration", () => {
    const video = createMockVideoWithAuthor({ duration: "15:30" });

    render(<VideoCard video={video} />);

    expect(screen.getByText("15:30")).toBeInTheDocument();
  });

  it("should render thumbnail image", () => {
    const video = createMockVideoWithAuthor({ thumbnailUrl: "/test-thumbnail.jpg", title: "Test Video" });

    render(<VideoCard video={video} />);

    const img = screen.getByRole("img", { name: "Test Video" });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", expect.stringContaining("test-thumbnail.jpg"));
  });

  it("should use placeholder image when no thumbnail", () => {
    const video = createMockVideoWithAuthor({ thumbnailUrl: null });

    render(<VideoCard video={video} />);

    const img = screen.getByRole("img", { name: video.title });
    expect(img).toHaveAttribute("src", expect.stringContaining("placeholder"));
  });

  it("should link to the video page", () => {
    const video = createMockVideoWithAuthor({ id: "video-abc-123" });

    render(<VideoCard video={video} organization="my-org" />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/my-org/videos/video-abc-123");
  });

  it("should use default organization when not provided", () => {
    const video = createMockVideoWithAuthor({ id: "video-xyz" });

    render(<VideoCard video={video} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/default/videos/video-xyz");
  });

  it("should render author avatar or fallback", () => {
    const video = createMockVideoWithAuthor({}, { name: "Jane Smith", image: "/jane-avatar.png" });

    render(<VideoCard video={video} />);

    // In jsdom, images don't load so we see the fallback text (first letter of name)
    expect(screen.getByText("J")).toBeInTheDocument();
  });

  it("should show author initial in avatar fallback", () => {
    const video = createMockVideoWithAuthor({}, { name: "Alice", image: null });

    render(<VideoCard video={video} />);

    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("should show 'A' fallback when author name is missing", () => {
    const video = createMockVideoWithAuthor({}, { name: null as unknown as string });

    render(<VideoCard video={video} />);

    // The component shows 'A' as fallback when name is null/undefined
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
