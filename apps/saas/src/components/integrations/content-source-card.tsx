'use client';

/**
 * Content Source Card Component
 *
 * Displays a content source connection with status and configuration options.
 */

import { logger } from '@nuclom/lib/client-logger';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@nuclom/ui/alert-dialog';
import { Badge } from '@nuclom/ui/badge';
import { Button } from '@nuclom/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@nuclom/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@nuclom/ui/dropdown-menu';
import { Progress } from '@nuclom/ui/progress';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  Check,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  MessageSquare,
  MoreVertical,
  RefreshCw,
  Settings2,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

// =============================================================================
// Types
// =============================================================================

export type ContentSourceType = 'slack' | 'notion' | 'github';
export type ContentSyncStatus = 'idle' | 'syncing' | 'completed' | 'failed';

export interface ContentSource {
  id: string;
  type: ContentSourceType;
  name: string;
  config: Record<string, unknown>;
  syncStatus: ContentSyncStatus;
  lastSyncAt: string | null;
  lastSyncError: string | null;
  itemCount: number;
  pendingCount: number;
  failedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContentSourceCardProps {
  source: ContentSource;
  onSync: (sourceId: string) => Promise<void>;
  onDelete: (sourceId: string) => Promise<void>;
  onConfigure: (sourceId: string) => void;
}

// =============================================================================
// Icons
// =============================================================================

export function SlackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>Slack</title>
      <rect width="24" height="24" rx="4" fill="#4A154B" />
      <path
        d="M8.5 13.5C8.5 14.328 7.828 15 7 15C6.172 15 5.5 14.328 5.5 13.5C5.5 12.672 6.172 12 7 12H8.5V13.5Z"
        fill="#E01E5A"
      />
      <path
        d="M9.25 13.5C9.25 12.672 9.922 12 10.75 12C11.578 12 12.25 12.672 12.25 13.5V17C12.25 17.828 11.578 18.5 10.75 18.5C9.922 18.5 9.25 17.828 9.25 17V13.5Z"
        fill="#E01E5A"
      />
      <path
        d="M10.75 8.5C9.922 8.5 9.25 7.828 9.25 7C9.25 6.172 9.922 5.5 10.75 5.5C11.578 5.5 12.25 6.172 12.25 7V8.5H10.75Z"
        fill="#36C5F0"
      />
      <path
        d="M10.75 9.25C11.578 9.25 12.25 9.922 12.25 10.75C12.25 11.578 11.578 12.25 10.75 12.25H7C6.172 12.25 5.5 11.578 5.5 10.75C5.5 9.922 6.172 9.25 7 9.25H10.75Z"
        fill="#36C5F0"
      />
      <path
        d="M15.5 10.75C15.5 9.922 16.172 9.25 17 9.25C17.828 9.25 18.5 9.922 18.5 10.75C18.5 11.578 17.828 12.25 17 12.25H15.5V10.75Z"
        fill="#2EB67D"
      />
      <path
        d="M14.75 10.75C14.75 11.578 14.078 12.25 13.25 12.25C12.422 12.25 11.75 11.578 11.75 10.75V7C11.75 6.172 12.422 5.5 13.25 5.5C14.078 5.5 14.75 6.172 14.75 7V10.75Z"
        fill="#2EB67D"
      />
      <path
        d="M13.25 15.5C14.078 15.5 14.75 16.172 14.75 17C14.75 17.828 14.078 18.5 13.25 18.5C12.422 18.5 11.75 17.828 11.75 17V15.5H13.25Z"
        fill="#ECB22E"
      />
      <path
        d="M13.25 14.75C12.422 14.75 11.75 14.078 11.75 13.25C11.75 12.422 12.422 11.75 13.25 11.75H17C17.828 11.75 18.5 12.422 18.5 13.25C18.5 14.078 17.828 14.75 17 14.75H13.25Z"
        fill="#ECB22E"
      />
    </svg>
  );
}

export function NotionIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>Notion</title>
      <rect width="24" height="24" rx="4" fill="white" stroke="#E5E5E5" strokeWidth="0.5" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M6.5 5.5C6.5 5.22386 6.72386 5 7 5H14.5L17.5 8V18.5C17.5 18.7761 17.2761 19 17 19H7C6.72386 19 6.5 18.7761 6.5 18.5V5.5Z"
        fill="white"
        stroke="black"
        strokeWidth="0.8"
      />
      <path d="M9 8H15M9 11H15M9 14H13" stroke="black" strokeWidth="0.8" strokeLinecap="round" />
    </svg>
  );
}

export function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <title>GitHub</title>
      <rect width="24" height="24" rx="4" fill="#24292F" />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 5C8.13401 5 5 8.13401 5 12C5 15.0971 7.0082 17.7074 9.78539 18.6063C10.1354 18.6694 10.2633 18.4539 10.2633 18.2692C10.2633 18.1034 10.2566 17.5753 10.2535 16.9948C8.17647 17.4181 7.76635 15.9756 7.76635 15.9756C7.44625 15.2017 6.97896 14.9866 6.97896 14.9866C6.33233 14.5414 7.02859 14.5503 7.02859 14.5503C7.74454 14.6007 8.12116 15.287 8.12116 15.287C8.75778 16.3859 9.87684 16.0746 10.2762 15.8961C10.3403 15.4459 10.5224 15.1355 10.7233 14.9593C9.07424 14.7811 7.34232 14.1199 7.34232 11.4544C7.34232 10.7221 7.61608 10.1217 8.1356 9.64995C8.06188 9.47153 7.82386 8.79139 8.20453 7.86147C8.20453 7.86147 8.80548 7.67117 10.2455 8.5449C10.8161 8.38892 11.4103 8.31102 12 8.30851C12.5897 8.31102 13.1841 8.38892 13.7554 8.5449C15.1945 7.67117 15.7945 7.86147 15.7945 7.86147C16.1761 8.79139 15.9379 9.47153 15.8644 9.64995C16.3848 10.1217 16.6565 10.7221 16.6565 11.4544C16.6565 14.1273 14.9212 14.7791 13.2673 14.9534C13.5218 15.1734 13.7482 15.6066 13.7482 16.2716C13.7482 17.2276 13.7399 17.9995 13.7399 18.2692C13.7399 18.4557 13.8651 18.6732 14.2213 18.6054C16.9953 17.7043 19 15.0959 19 12C19 8.13401 15.866 5 12 5Z"
        fill="white"
      />
    </svg>
  );
}

// =============================================================================
// Helpers
// =============================================================================

const SOURCE_CONFIG = {
  slack: {
    name: 'Slack',
    icon: SlackIcon,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50 dark:bg-purple-950/50',
    borderColor: 'border-purple-200 dark:border-purple-800',
    description: 'Import messages, threads, and discussions',
    contentLabel: 'messages',
    contentIcon: MessageSquare,
  },
  notion: {
    name: 'Notion',
    icon: NotionIcon,
    color: 'text-gray-900 dark:text-gray-100',
    bgColor: 'bg-gray-50 dark:bg-gray-950/50',
    borderColor: 'border-gray-200 dark:border-gray-700',
    description: 'Import pages, databases, and documents',
    contentLabel: 'pages',
    contentIcon: FileText,
  },
  github: {
    name: 'GitHub',
    icon: GitHubIcon,
    color: 'text-gray-900 dark:text-gray-100',
    bgColor: 'bg-gray-50 dark:bg-gray-950/50',
    borderColor: 'border-gray-200 dark:border-gray-700',
    description: 'Import issues, PRs, and discussions',
    contentLabel: 'items',
    contentIcon: FileText,
  },
};

const STATUS_CONFIG = {
  idle: { label: 'Ready', variant: 'secondary' as const, icon: Check },
  syncing: { label: 'Syncing', variant: 'default' as const, icon: RefreshCw },
  completed: { label: 'Synced', variant: 'secondary' as const, icon: Check },
  failed: { label: 'Failed', variant: 'destructive' as const, icon: AlertCircle },
};

// =============================================================================
// Component
// =============================================================================

export function ContentSourceCard({ source, onSync, onDelete, onConfigure }: ContentSourceCardProps) {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const config = SOURCE_CONFIG[source.type];
  const statusConfig = STATUS_CONFIG[source.syncStatus];
  const Icon = config.icon;
  const ContentIcon = config.contentIcon;
  const StatusIcon = statusConfig.icon;

  const handleSync = async () => {
    try {
      setSyncing(true);
      await onSync(source.id);
      toast({
        title: 'Sync Started',
        description: `${config.name} sync has been started.`,
      });
    } catch (error) {
      logger.error(`Failed to start sync for ${config.name}`, error);
      toast({
        title: 'Sync Failed',
        description: `Failed to start sync for ${config.name}.`,
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await onDelete(source.id);
      toast({
        title: 'Source Removed',
        description: `${config.name} source has been disconnected.`,
      });
    } catch (error) {
      logger.error(`Failed to remove ${config.name} source`, error);
      toast({
        title: 'Delete Failed',
        description: `Failed to remove ${config.name} source.`,
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const totalItems = source.itemCount;
  const processedItems = totalItems - source.pendingCount - source.failedCount;
  const progressPercent = totalItems > 0 ? Math.round((processedItems / totalItems) * 100) : 0;

  return (
    <Card className={`overflow-hidden transition-all hover:shadow-md ${config.borderColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${config.bgColor}`}>
              <Icon className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{source.name}</CardTitle>
                <Badge
                  variant={statusConfig.variant}
                  className={`text-xs font-normal ${source.syncStatus === 'syncing' ? 'animate-pulse' : ''}`}
                >
                  <StatusIcon className={`h-3 w-3 mr-1 ${source.syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                  {statusConfig.label}
                </Badge>
              </div>
              <CardDescription className="text-sm">{config.description}</CardDescription>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onConfigure(source.id)}>
                <Settings2 className="h-4 w-4 mr-2" />
                Configure
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSync} disabled={syncing || source.syncStatus === 'syncing'}>
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Sync Now
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={(e) => e.preventDefault()}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Disconnect
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect {config.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the {config.name} content source and all imported content. This action cannot be
                      undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deleting}
                    >
                      {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-4">
        <div className="space-y-3">
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ContentIcon className="h-4 w-4" />
              <span>
                {source.itemCount.toLocaleString()} {config.contentLabel}
              </span>
            </div>
            {source.lastSyncAt && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Synced {formatDistanceToNow(new Date(source.lastSyncAt), { addSuffix: true })}</span>
              </div>
            )}
          </div>

          {/* Progress */}
          {source.pendingCount > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Processing {source.pendingCount} items...</span>
                <span className="font-medium">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-1.5" />
            </div>
          )}

          {/* Error */}
          {source.lastSyncError && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="line-clamp-2">{source.lastSyncError}</span>
            </div>
          )}

          {/* Failed count */}
          {source.failedCount > 0 && !source.lastSyncError && (
            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{source.failedCount} items failed to process</span>
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="border-t bg-muted/30 py-3">
        <div className="flex w-full gap-2">
          <Button
            variant="default"
            size="sm"
            className="flex-1"
            onClick={handleSync}
            disabled={syncing || source.syncStatus === 'syncing'}
          >
            {syncing || source.syncStatus === 'syncing' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync Now
          </Button>
          <Button variant="outline" size="sm" onClick={() => onConfigure(source.id)}>
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

// =============================================================================
// Empty State Card
// =============================================================================

export interface AddContentSourceCardProps {
  type: ContentSourceType;
  onConnect: (type: ContentSourceType) => void;
}

export function AddContentSourceCard({ type, onConnect }: AddContentSourceCardProps) {
  const config = SOURCE_CONFIG[type];
  const Icon = config.icon;

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md hover:border-primary/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${config.bgColor}`}>
            <Icon className="h-7 w-7" />
          </div>
          <div>
            <CardTitle className="text-base">{config.name}</CardTitle>
            <CardDescription className="text-sm">{config.description}</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-4">
        <p className="text-sm text-muted-foreground">
          Connect your {config.name} workspace to import {config.contentLabel} and build your knowledge base.
        </p>
      </CardContent>

      <CardFooter className="border-t bg-muted/30 py-3">
        <Button className="w-full" onClick={() => onConnect(type)}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Connect {config.name}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default ContentSourceCard;
