"use client";

import { Play, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface DashboardHeroProps {
  organization: string;
  userName?: string;
  hasVideos?: boolean;
}

export function DashboardHero({ organization, userName, hasVideos }: DashboardHeroProps) {
  const greeting = getGreeting();

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-8">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-30">
        <svg
          className="absolute right-0 top-0 h-full w-1/2"
          viewBox="0 0 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="300" cy="100" r="200" stroke="currentColor" strokeWidth="0.5" className="text-primary/20" />
          <circle cx="350" cy="150" r="150" stroke="currentColor" strokeWidth="0.5" className="text-primary/20" />
          <circle cx="280" cy="200" r="100" stroke="currentColor" strokeWidth="0.5" className="text-primary/20" />
        </svg>
      </div>

      <div className="relative z-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2">
          {greeting}
          {userName ? `, ${userName.split(" ")[0]}` : ""}!
        </h1>
        <p className="text-muted-foreground mb-6 max-w-lg">
          {hasVideos
            ? "Pick up where you left off or explore new videos from your team."
            : "Get started by uploading your first video or recording a quick update."}
        </p>

        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={`/${organization}/upload`}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Video
            </Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link href={`/${organization}/record`}>
              <div className="mr-2 h-4 w-4 rounded-full bg-red-500 animate-pulse" />
              Record
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
