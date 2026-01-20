'use client';

import { cn } from '@nuclom/lib/utils';
import { Hash, Tags } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// =============================================================================
// Types
// =============================================================================

export interface TopicData {
  id: string;
  name: string;
  description: string | null;
  keywords: string[];
  contentCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  parentId?: string | null;
}

interface TopicCardProps {
  topic: TopicData;
  onClick?: () => void;
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

export function TopicCard({ topic, onClick, className }: TopicCardProps) {
  const createdAt = typeof topic.createdAt === 'string' ? new Date(topic.createdAt) : topic.createdAt;

  return (
    <Card
      className={cn(
        'hover:bg-accent/50 transition-colors cursor-pointer',
        className,
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
              <Tags className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <CardTitle className="text-base">{topic.name}</CardTitle>
          </div>
          <Badge variant="outline" className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {topic.contentCount}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {topic.description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{topic.description}</p>
        )}
        {topic.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {topic.keywords.slice(0, 5).map((keyword) => (
              <Badge key={keyword} variant="secondary" className="text-xs">
                {keyword}
              </Badge>
            ))}
            {topic.keywords.length > 5 && (
              <Badge variant="secondary" className="text-xs">
                +{topic.keywords.length - 5} more
              </Badge>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Created {formatDistanceToNow(createdAt, { addSuffix: true })}
        </p>
      </CardContent>
    </Card>
  );
}
