"use client";

import { Check, ChevronRight, Play, Settings, Upload, Users, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  completed: boolean;
}

interface GettingStartedChecklistProps {
  organization: string;
  hasVideos?: boolean;
  hasTeamMembers?: boolean;
  hasIntegrations?: boolean;
}

export function GettingStartedChecklist({
  organization,
  hasVideos = false,
  hasTeamMembers = false,
  hasIntegrations = false,
}: GettingStartedChecklistProps) {
  const [dismissed, setDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(`onboarding-dismissed-${organization}`);
    if (stored === "true") {
      setDismissed(true);
    }
  }, [organization]);

  const items: ChecklistItem[] = [
    {
      id: "upload",
      title: "Upload your first video",
      description: "Share a screen recording or video update",
      icon: Upload,
      href: `/${organization}/upload`,
      completed: hasVideos,
    },
    {
      id: "invite",
      title: "Invite your team",
      description: "Collaborate with teammates on videos",
      icon: Users,
      href: `/${organization}/settings/members`,
      completed: hasTeamMembers,
    },
    {
      id: "integrations",
      title: "Connect your tools",
      description: "Import recordings from Zoom or Google Meet",
      icon: Settings,
      href: `/${organization}/settings/integrations`,
      completed: hasIntegrations,
    },
    {
      id: "tour",
      title: "Take a quick tour",
      description: "Learn the basics in 2 minutes",
      icon: Play,
      href: `/${organization}?tour=true`,
      completed: false,
    },
  ];

  const completedCount = items.filter((item) => item.completed).length;
  const progress = (completedCount / items.length) * 100;

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => {
      localStorage.setItem(`onboarding-dismissed-${organization}`, "true");
      setDismissed(true);
    }, 300);
  };

  // Don't show if all items are completed or if dismissed
  if (dismissed || completedCount === items.length) {
    return null;
  }

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-300 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background",
        !isVisible && "opacity-0 scale-95"
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-3 right-3 h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={handleDismiss}
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Dismiss</span>
      </Button>

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between pr-8">
          <CardTitle className="text-lg">Getting Started</CardTitle>
          <span className="text-sm text-muted-foreground">
            {completedCount} of {items.length} complete
          </span>
        </div>
        <Progress value={progress} className="h-2 mt-2" />
      </CardHeader>

      <CardContent className="pt-0">
        <div className="space-y-1">
          {items.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-4 p-3 rounded-lg transition-colors hover:bg-muted/50",
                item.completed && "opacity-60"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                  item.completed
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-primary/10 text-primary"
                )}
              >
                {item.completed ? (
                  <Check className="w-5 h-5" />
                ) : (
                  <item.icon className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "font-medium text-sm",
                    item.completed && "line-through text-muted-foreground"
                  )}
                >
                  {item.title}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.description}
                </p>
              </div>
              {!item.completed && (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
