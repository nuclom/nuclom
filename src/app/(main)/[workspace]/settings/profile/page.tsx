"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { authClient } from "@/lib/auth-client";

export default function ProfileSettingsPage() {
  const { user, isLoading } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setMessage(null);

    try {
      const result = await authClient.updateUser({
        name,
      });

      if (result.error) {
        setMessage({ type: "error", text: result.error.message || "Failed to update profile" });
      } else {
        setMessage({ type: "success", text: "Profile updated successfully!" });
      }
    } catch (error) {
      console.error("Profile update error:", error);
      setMessage({ type: "error", text: "An unexpected error occurred" });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
          <CardDescription>Loading your profile information...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 bg-muted rounded-full" />
              <div className="h-9 w-24 bg-muted rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-20 bg-muted rounded" />
              <div className="h-10 bg-muted rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Profile</CardTitle>
        <CardDescription>Manage your personal information.</CardDescription>
      </CardHeader>
      <form onSubmit={handleSaveChanges}>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={user?.image || "/placeholder.svg?height=80&width=80"} />
              <AvatarFallback className="text-lg">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <Button type="button" variant="outline" disabled={isUpdating}>
              Change Photo
            </Button>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isUpdating}
              placeholder="Enter your full name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={user?.email || ""}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Email address cannot be changed. Contact support if you need to update it.
            </p>
          </div>
          {message && (
            <div
              className={`text-sm p-3 rounded-md ${
                message.type === "success"
                  ? "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20"
                  : "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20"
              }`}
            >
              {message.text}
            </div>
          )}
        </CardContent>
        <CardFooter className="bg-muted/50 border-t px-6 py-4">
          <Button type="submit" disabled={isUpdating || !name.trim()}>
            {isUpdating ? "Saving..." : "Save Changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
