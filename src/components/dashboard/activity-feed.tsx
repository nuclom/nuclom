"use client";

import { Clock, MessageSquare, Play, Upload, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: "upload" | "comment" | "view" | "share" | "join";
  user: {
    name: string;
    image?: string;
  };
  target?: string;
  timestamp: Date;
}

interface ActivityFeedProps {
  activities?: ActivityItem[];
  className?: string;
}

const activityIcons = {
  upload: Upload,
  comment: MessageSquare,
  view: Play,
  share: Users,
  join: Users,
};

const activityMessages = {
  upload: "uploaded a video",
  comment: "commented on",
  view: "watched",
  share: "shared",
  join: "joined the workspace",
};

export function ActivityFeed({ activities = [], className }: ActivityFeedProps) {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  // Demo activities if none provided
  const displayActivities: ActivityItem[] =
    activities.length > 0
      ? activities
      : [
          {
            id: "1",
            type: "upload",
            user: { name: "Alex Chen" },
            target: "Q4 Product Demo",
            timestamp: new Date(Date.now() - 3600000),
          },
          {
            id: "2",
            type: "comment",
            user: { name: "Sarah Miller" },
            target: "Engineering Standup",
            timestamp: new Date(Date.now() - 7200000),
          },
          {
            id: "3",
            type: "view",
            user: { name: "James Wilson" },
            target: "Onboarding Guide",
            timestamp: new Date(Date.now() - 18000000),
          },
        ];

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
        ) : (
          <div className="space-y-4">
            {displayActivities.map((activity) => {
              const Icon = activityIcons[activity.type];
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={activity.user.image} />
                    <AvatarFallback className="text-xs">{getInitials(activity.user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{activity.user.name}</span>{" "}
                      <span className="text-muted-foreground">{activityMessages[activity.type]}</span>
                      {activity.target && (
                        <>
                          {" "}
                          <span className="font-medium">{activity.target}</span>
                        </>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatTime(activity.timestamp)}</p>
                  </div>
                  <div className="p-1.5 rounded-md bg-muted">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
