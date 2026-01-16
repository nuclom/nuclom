'use client';

import { CheckCircle2, Circle, Clock, Filter, Loader2, Play, User, Video, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ActionItem {
  id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  assigneeUserId: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  dueDate: string | null;
  completedAt: string | null;
  timestampStart: number | null;
  videoId: string;
  createdAt: string;
  video: {
    id: string;
    title: string;
    thumbnailUrl: string | null;
  } | null;
}

interface ActionItemStats {
  pending: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  total: number;
}

interface ActionItemTrackerProps {
  actionItems: ActionItem[];
  stats: ActionItemStats;
  onStatusChange?: (id: string, status: ActionItem['status']) => Promise<void>;
  isLoading?: boolean;
}

function StatusIcon({ status }: { status: ActionItem['status'] }) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'in_progress':
      return <Play className="h-4 w-4 text-blue-600" />;
    case 'cancelled':
      return <XCircle className="h-4 w-4 text-gray-400" />;
    default:
      return <Circle className="h-4 w-4 text-yellow-600" />;
  }
}

function PriorityBadge({ priority }: { priority: ActionItem['priority'] }) {
  const variants = {
    high: 'destructive',
    medium: 'default',
    low: 'secondary',
  } as const;

  return (
    <Badge variant={variants[priority]} className="text-xs">
      {priority}
    </Badge>
  );
}

function formatDate(dateString: string | null) {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function ActionItemTracker({ actionItems, stats, onStatusChange, isLoading }: ActionItemTrackerProps) {
  const [filter, setFilter] = useState<ActionItem['status'] | 'all'>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const filteredItems = filter === 'all' ? actionItems : actionItems.filter((item) => item.status === filter);

  const handleStatusChange = async (id: string, newStatus: ActionItem['status']) => {
    if (!onStatusChange) return;

    setUpdatingId(id);
    try {
      await onStatusChange(id, newStatus);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleComplete = async (item: ActionItem) => {
    const newStatus = item.status === 'completed' ? 'pending' : 'completed';
    await handleStatusChange(item.id, newStatus);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium">Action Items</CardTitle>
            <CardDescription>
              {stats.total} total · {stats.pending} pending · {stats.completed} completed
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                {filter === 'all' ? 'All' : filter.replace('_', ' ')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setFilter('all')}>All ({stats.total})</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('pending')}>Pending ({stats.pending})</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('in_progress')}>
                In Progress ({stats.inProgress})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('completed')}>Completed ({stats.completed})</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('cancelled')}>Cancelled ({stats.cancelled})</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mb-2" />
            <p>No action items {filter !== 'all' ? `with status "${filter.replace('_', ' ')}"` : ''}</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                    item.status === 'completed' ? 'bg-muted/50 opacity-75' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="pt-0.5">
                    {onStatusChange ? (
                      <Checkbox
                        checked={item.status === 'completed'}
                        disabled={updatingId === item.id}
                        onCheckedChange={() => handleToggleComplete(item)}
                      />
                    ) : (
                      <StatusIcon status={item.status} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className={`font-medium text-sm ${
                          item.status === 'completed' ? 'line-through text-muted-foreground' : ''
                        }`}
                      >
                        {item.title}
                      </p>
                      <PriorityBadge priority={item.priority} />
                    </div>

                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {item.assignee && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {item.assignee}
                        </span>
                      )}
                      {item.video && (
                        <span className="flex items-center gap-1 truncate max-w-[150px]">
                          <Video className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{item.video.title}</span>
                        </span>
                      )}
                      {item.dueDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Due {formatDate(item.dueDate)}
                        </span>
                      )}
                    </div>
                  </div>

                  {updatingId === item.id && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
