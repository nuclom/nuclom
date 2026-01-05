"use client";

import { CheckCircle2, Eye, EyeOff, Github } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { authClient, getLastUsedLoginMethod } from "@/lib/auth-client";

interface LoginFormProps {
  readonly redirectTo?: string;
}

// Map login method IDs to display labels
function getLoginMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    email: "Email",
    github: "GitHub",
    google: "Google",
    passkey: "Passkey",
  };
  return labels[method] ?? method;
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoginMethod, setLastLoginMethod] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get redirect URL from search params or use default
  const finalRedirectTo = redirectTo || searchParams.get("redirectTo") || "/onboarding";

  // Fetch last login method on component mount
  useEffect(() => {
    async function fetchLastLoginMethod() {
      try {
        const result = await getLastUsedLoginMethod();
        // Handle different return types from the API
        if (result) {
          if (typeof result === "string") {
            setLastLoginMethod(result);
          } else if (typeof result === "object") {
            const data = (result as { data?: string }).data;
            if (data) {
              setLastLoginMethod(data);
            }
          }
        }
      } catch {
        // Silently ignore errors - this is a convenience feature
      }
    }
    fetchLastLoginMethod();
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message || "Failed to sign in");
      } else {
        router.push(finalRedirectTo);
        router.refresh();
      }
    } catch (err) {
      setError("An unexpected error occurred");
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGithubLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: finalRedirectTo,
      });
    } catch (err) {
      setError("Failed to sign in with GitHub");
      console.error("GitHub login error:", err);
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Welcome back</CardTitle>
        <CardDescription className="text-center">Sign in to your account to continue</CardDescription>
        {lastLoginMethod && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Badge variant="secondary" className="gap-1.5">
              <CheckCircle2 className="h-3 w-3" />
              Last signed in with {getLoginMethodLabel(lastLoginMethod)}
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Button variant="link" className="p-0 h-auto font-normal text-sm" asChild>
                <a href="/forgot-password">Forgot password?</a>
              </Button>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>

        <Button
          variant={lastLoginMethod === "github" ? "default" : "outline"}
          className="w-full"
          onClick={handleGithubLogin}
          disabled={isLoading}
        >
          <Github className="mr-2 h-4 w-4" />
          GitHub
          {lastLoginMethod === "github" && " (recommended)"}
        </Button>
      </CardContent>
      <CardFooter className="text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Button variant="link" className="p-0 h-auto font-normal" disabled={isLoading} asChild>
          <a
            href={`/register${finalRedirectTo !== "/onboarding" ? `?redirectTo=${encodeURIComponent(finalRedirectTo)}` : ""}`}
          >
            Sign up
          </a>
        </Button>
      </CardFooter>
    </Card>
  );
}
