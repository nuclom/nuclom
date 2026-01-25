'use client';

import { cn } from '@nuclom/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@nuclom/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@nuclom/ui/card';
import { Clock, MessageSquare, Play, Upload, Users } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'upload' | 'comment' | 'view' | 'share' | 'join';
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
  upload: 'uploaded a video',
  comment: 'commented on',
  view: 'watched',
  share: 'shared',
  join: 'joined the workspace',
};

export function ActivityFeed({ activities = [], className }: ActivityFeedProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No recent activity</p>
            <p className="text-xs text-muted-foreground mt-1">Activity from your team will appear here</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const Icon = activityIcons[activity.type];
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={activity.user.image} />
                    <AvatarFallback className="text-xs">{getInitials(activity.user.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{activity.user.name}</span>{' '}
                      <span className="text-muted-foreground">{activityMessages[activity.type]}</span>
                      {activity.target && (
                        <>
                          {' '}
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
