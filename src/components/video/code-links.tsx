'use client';

import { CircleDot, File, Folder, GitCommit, GitPullRequest, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CodeLink } from '@/hooks/use-code-links';
import type { CodeLinkType } from '@/lib/db/schema';
import { formatTime } from '@/lib/format-utils';

// =============================================================================
// Icon Mapping
// =============================================================================

const LINK_TYPE_CONFIG: Record<
  CodeLinkType,
  {
    icon: typeof GitPullRequest;
    label: string;
    color: string;
  }
> = {
  pr: {
    icon: GitPullRequest,
    label: 'Pull Request',
    color: 'text-purple-500',
  },
  issue: {
    icon: CircleDot,
    label: 'Issue',
    color: 'text-green-500',
  },
  commit: {
    icon: GitCommit,
    label: 'Commit',
    color: 'text-blue-500',
  },
  file: {
    icon: File,
    label: 'File',
    color: 'text-orange-500',
  },
  directory: {
    icon: Folder,
    label: 'Directory',
    color: 'text-yellow-500',
  },
};

// =============================================================================
// Code Link Item Component
// =============================================================================

interface CodeLinkItemProps {
  link: CodeLink;
  currentUserId?: string;
  onDelete: (linkId: string) => Promise<void>;
}

function CodeLinkItem({ link, currentUserId, onDelete }: CodeLinkItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const config = LINK_TYPE_CONFIG[link.linkType];
  const Icon = config.icon;
  const canDelete = currentUserId && link.createdById === currentUserId;

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove this code link?')) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(link.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors group">
      <div className={`mt-0.5 ${config.color}`}>
        <Icon className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={link.githubUrl || `https://github.com/${link.githubRepo}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-sm hover:underline"
          >
            {link.githubRepo}
          </a>
          <Badge variant="secondary" className="text-xs">
            {config.label}
          </Badge>
          {link.autoDetected && (
            <Badge variant="outline" className="text-xs">
              Auto-detected
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <code className="px-1.5 py-0.5 rounded bg-muted font-mono">{link.githubRef}</code>
          {link.timestampStart !== null && (
            <>
              <span>•</span>
              <span className="font-mono">{formatTime(link.timestampStart)}</span>
              {link.timestampEnd !== null && (
                <>
                  <span>-</span>
                  <span className="font-mono">{formatTime(link.timestampEnd)}</span>
                </>
              )}
            </>
          )}
        </div>

        {link.context && <p className="text-xs text-muted-foreground line-clamp-2">{link.context}</p>}

        {link.createdBy && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Avatar className="h-4 w-4">
              <AvatarImage src={link.createdBy.image || undefined} alt={link.createdBy.name} />
              <AvatarFallback>{link.createdBy.name[0]}</AvatarFallback>
            </Avatar>
            <span>{link.createdBy.name}</span>
          </div>
        )}
      </div>

      {canDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}

// =============================================================================
// Code Links List Component
// =============================================================================

interface CodeLinksProps {
  codeLinks: CodeLink[];
  loading: boolean;
  error: string | null;
  currentUserId?: string;
  onDelete: (linkId: string) => Promise<void>;
}

export function CodeLinks({ codeLinks, loading, error, currentUserId, onDelete }: CodeLinksProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Loading code links...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (codeLinks.length === 0) {
    return (
      <div className="text-center py-8">
        <GitPullRequest className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
        <p className="text-sm text-muted-foreground">No code links yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Link GitHub PRs, issues, commits, or files to this video.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {codeLinks.map((link) => (
        <CodeLinkItem key={link.id} link={link} currentUserId={currentUserId} onDelete={onDelete} />
      ))}
    </div>
  );
}
