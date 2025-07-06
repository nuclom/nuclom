import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoginForm } from "../login-form";

// Mock the auth client
vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: {
      email: vi.fn(),
      social: vi.fn(),
    },
  },
}));

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login form correctly", () => {
    render(<LoginForm />);

    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByText("Sign in to your account to continue")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "GitHub" })).toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const passwordInput = screen.getByLabelText("Password");
    // Find the toggle button by finding the button within the password field container
    const passwordContainer = passwordInput.closest('.relative');
    const toggleButton = passwordContainer?.querySelector('button[type="button"]') as HTMLElement;

    expect(passwordInput).toHaveAttribute("type", "password");
    expect(toggleButton).toBeInTheDocument();

    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute("type", "text");

    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("handles form submission with valid credentials", async () => {
    const user = userEvent.setup();
    const mockSignIn = vi.fn().mockResolvedValue({ error: null });

    const { authClient } = await import("@/lib/auth-client");
    authClient.signIn.email = mockSignIn;

    render(<LoginForm />);

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign in" });

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });

    expect(mockPush).toHaveBeenCalledWith("/vercel");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("displays error message on failed login", async () => {
    const user = userEvent.setup();
    const mockSignIn = vi.fn().mockResolvedValue({
      error: { message: "Invalid credentials" },
    });

    const { authClient } = await import("@/lib/auth-client");
    authClient.signIn.email = mockSignIn;

    render(<LoginForm />);

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign in" });

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "wrongpassword");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
  });

  it("handles GitHub sign in", async () => {
    const user = userEvent.setup();
    const mockSocialSignIn = vi.fn();

    const { authClient } = await import("@/lib/auth-client");
    authClient.signIn.social = mockSocialSignIn;

    render(<LoginForm />);

    const githubButton = screen.getByRole("button", { name: "GitHub" });
    await user.click(githubButton);

    expect(mockSocialSignIn).toHaveBeenCalledWith({
      provider: "github",
      callbackURL: "/vercel",
    });
  });

  it("uses custom redirect URL when provided", () => {
    render(<LoginForm redirectTo="/custom-redirect" />);

    const signUpLink = screen.getByText("Sign up");
    expect(signUpLink).toHaveAttribute("href", "/register?redirectTo=%2Fcustom-redirect");
  });

  it("disables form elements when loading", async () => {
    const user = userEvent.setup();
    const mockSignIn = vi.fn().mockImplementation(() => new Promise(() => {})); // Never resolves

    const { authClient } = await import("@/lib/auth-client");
    authClient.signIn.email = mockSignIn;

    render(<LoginForm />);

    const emailInput = screen.getByLabelText("Email");
    const passwordInput = screen.getByLabelText("Password");
    const submitButton = screen.getByRole("button", { name: "Sign in" });
    const githubButton = screen.getByRole("button", { name: "GitHub" });

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Signing in...")).toBeInTheDocument();
    });

    expect(emailInput).toBeDisabled();
    expect(passwordInput).toBeDisabled();
    expect(submitButton).toBeDisabled();
    expect(githubButton).toBeDisabled();
  });
});
