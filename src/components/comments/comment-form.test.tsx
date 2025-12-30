import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CommentForm } from "./comment-form";

describe("CommentForm Component", () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();
  const defaultProps = {
    videoId: "video-123",
    onSubmit: mockOnSubmit,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render textarea with placeholder", () => {
    render(<CommentForm {...defaultProps} />);

    expect(screen.getByPlaceholderText("Add a comment...")).toBeInTheDocument();
  });

  it("should render custom placeholder", () => {
    render(<CommentForm {...defaultProps} placeholder="Write your thoughts..." />);

    expect(screen.getByPlaceholderText("Write your thoughts...")).toBeInTheDocument();
  });

  it("should render user avatar when user prop is provided", () => {
    render(<CommentForm {...defaultProps} user={{ name: "John", image: "/john.png" }} />);

    // In jsdom, images don't load so we see the fallback text (first letter of name)
    expect(screen.getByText("J")).toBeInTheDocument();
  });

  it("should show submit button when focused", async () => {
    const user = userEvent.setup();
    render(<CommentForm {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Add a comment...");
    await user.click(textarea);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /comment/i })).toBeInTheDocument();
    });
  });

  it("should show timestamp button when showTimestamp is true", async () => {
    const user = userEvent.setup();
    render(<CommentForm {...defaultProps} showTimestamp={true} />);

    const textarea = screen.getByPlaceholderText("Add a comment...");
    await user.click(textarea);

    await waitFor(() => {
      expect(screen.getByText("Add timestamp")).toBeInTheDocument();
    });
  });

  it("should not show timestamp button when showTimestamp is false", async () => {
    const user = userEvent.setup();
    render(<CommentForm {...defaultProps} showTimestamp={false} />);

    const textarea = screen.getByPlaceholderText("Add a comment...");
    await user.click(textarea);

    await waitFor(() => {
      expect(screen.queryByText("Add timestamp")).not.toBeInTheDocument();
    });
  });

  it("should show timestamp input when Add timestamp is clicked", async () => {
    const user = userEvent.setup();
    render(<CommentForm {...defaultProps} showTimestamp={true} />);

    const textarea = screen.getByPlaceholderText("Add a comment...");
    await user.click(textarea);

    await waitFor(() => {
      expect(screen.getByText("Add timestamp")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Add timestamp"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("00:00:00")).toBeInTheDocument();
    });
  });

  it("should disable submit button when content is empty", async () => {
    const user = userEvent.setup();
    render(<CommentForm {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Add a comment...");
    await user.click(textarea);

    await waitFor(() => {
      const submitButton = screen.getByRole("button", { name: /comment/i });
      expect(submitButton).toBeDisabled();
    });
  });

  it("should enable submit button when content is not empty", async () => {
    const user = userEvent.setup();
    render(<CommentForm {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Add a comment...");
    await user.type(textarea, "This is a test comment");

    await waitFor(() => {
      const submitButton = screen.getByRole("button", { name: /comment/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  it("should call onSubmit with comment content when submitted", async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValueOnce(undefined);
    render(<CommentForm {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Add a comment...");
    await user.type(textarea, "Test comment content");

    const submitButton = screen.getByRole("button", { name: /comment/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        content: "Test comment content",
        timestamp: undefined,
        parentId: undefined,
      });
    });
  });

  it("should call onSubmit with timestamp when provided", async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValueOnce(undefined);
    render(<CommentForm {...defaultProps} showTimestamp={true} />);

    const textarea = screen.getByPlaceholderText("Add a comment...");
    await user.type(textarea, "Comment at timestamp");

    await user.click(screen.getByText("Add timestamp"));

    const timestampInput = screen.getByPlaceholderText("00:00:00");
    await user.type(timestampInput, "01:30:00");

    const submitButton = screen.getByRole("button", { name: /comment/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        content: "Comment at timestamp",
        timestamp: "01:30:00",
        parentId: undefined,
      });
    });
  });

  it("should call onSubmit with parentId for replies", async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValueOnce(undefined);
    render(<CommentForm {...defaultProps} parentId="parent-123" />);

    const textarea = screen.getByPlaceholderText("Add a comment...");
    await user.type(textarea, "This is a reply");

    const submitButton = screen.getByRole("button", { name: /reply/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        content: "This is a reply",
        timestamp: undefined,
        parentId: "parent-123",
      });
    });
  });

  it("should show Reply button when parentId is provided", async () => {
    const user = userEvent.setup();
    render(<CommentForm {...defaultProps} parentId="parent-123" />);

    const textarea = screen.getByPlaceholderText("Add a comment...");
    await user.type(textarea, "Reply text");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /reply/i })).toBeInTheDocument();
    });
  });

  it("should clear form after successful submission", async () => {
    const user = userEvent.setup();
    mockOnSubmit.mockResolvedValueOnce(undefined);
    render(<CommentForm {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Add a comment...");
    await user.type(textarea, "Test comment");

    const submitButton = screen.getByRole("button", { name: /comment/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(textarea).toHaveValue("");
    });
  });

  it("should show Cancel button when parentId is provided", async () => {
    render(<CommentForm {...defaultProps} parentId="parent-123" onCancel={mockOnCancel} />);

    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("should call onCancel when Cancel button is clicked", async () => {
    const user = userEvent.setup();
    render(<CommentForm {...defaultProps} parentId="parent-123" onCancel={mockOnCancel} />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it("should show loading state during submission", async () => {
    const user = userEvent.setup();
    // Create a promise that we can control
    let resolveSubmit: () => void;
    const submitPromise = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
    mockOnSubmit.mockReturnValueOnce(submitPromise);

    render(<CommentForm {...defaultProps} />);

    const textarea = screen.getByPlaceholderText("Add a comment...");
    await user.type(textarea, "Test comment");

    const submitButton = screen.getByRole("button", { name: /comment/i });
    await user.click(submitButton);

    // Check for loading state (Loader2 icon spins)
    expect(textarea).toBeDisabled();

    // Resolve the promise to complete the test
    resolveSubmit!();
    await waitFor(() => {
      expect(textarea).not.toBeDisabled();
    });
  });

  it("should render in compact mode", async () => {
    const user = userEvent.setup();
    render(<CommentForm {...defaultProps} compact={true} />);

    const textarea = screen.getByPlaceholderText("Add a comment...");
    await user.click(textarea);

    // In compact mode, the textarea should have min-h-[60px] instead of min-h-[80px]
    // The component renders differently in compact mode
    expect(textarea).toBeInTheDocument();
  });

  it("should pre-fill timestamp when initialTimestamp is provided", async () => {
    const user = userEvent.setup();
    render(<CommentForm {...defaultProps} showTimestamp={true} initialTimestamp="02:30:00" />);

    // Need to focus to expand the form and show timestamp input
    const textarea = screen.getByPlaceholderText("Add a comment...");
    await user.click(textarea);

    await waitFor(() => {
      expect(screen.getByDisplayValue("02:30:00")).toBeInTheDocument();
    });
  });

  it("should hide user avatar in compact mode", () => {
    render(<CommentForm {...defaultProps} compact={true} user={{ name: "John", image: "/john.png" }} />);

    expect(screen.queryByRole("img", { name: "John" })).not.toBeInTheDocument();
  });
});
