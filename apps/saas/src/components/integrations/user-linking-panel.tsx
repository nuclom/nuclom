'use client';

/**
 * User Linking Panel
 *
 * Displays external users from a content source and allows linking
 * them to Nuclom organization members.
 */

import { logger } from '@nuclom/lib/client-logger';
import { cn } from '@nuclom/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@nuclom/ui/avatar';
import { Badge } from '@nuclom/ui/badge';
import { Button } from '@nuclom/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@nuclom/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@nuclom/ui/popover';
import { ScrollArea } from '@nuclom/ui/scroll-area';
import { Skeleton } from '@nuclom/ui/skeleton';
import { AlertCircle, Check, ChevronDown, Link2, Link2Off, Loader2, User } from 'lucide-react';
import { useCallback, useState } from 'react';
import useSWR, { mutate } from 'swr';

// =============================================================================
// Types
// =============================================================================

interface Suggestion {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  confidence: number;
  reason: string;
}

interface ExternalUser {
  externalId: string;
  name: string;
  email: string | null;
  itemCount: number;
  linkedUserId: string | null;
  linkedUserName: string | null;
  linkedUserEmail: string | null;
  linkedUserImage: string | null;
  suggestions: Suggestion[];
}

interface UsersResponse {
  users: ExternalUser[];
  total: number;
  linked: number;
  unlinked: number;
}

interface OrgMember {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

export interface UserLinkingPanelProps {
  sourceId: string;
  organizationId: string;
  className?: string;
}

// =============================================================================
// Fetcher
// =============================================================================

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// =============================================================================
// Component
// =============================================================================

export function UserLinkingPanel({ sourceId, organizationId, className }: UserLinkingPanelProps) {
  const [filter, setFilter] = useState<'all' | 'unlinked' | 'linked'>('unlinked');
  const [linkingUser, setLinkingUser] = useState<string | null>(null);

  // Fetch external users from the source
  const usersUrl = `/api/content/sources/${sourceId}/users${filter !== 'all' ? `?linked=${filter === 'linked'}` : ''}`;
  const { data: usersData, error: usersError, isLoading: usersLoading } = useSWR<UsersResponse>(usersUrl, fetcher);

  // Fetch org members for the dropdown
  const membersUrl = `/api/organizations/${organizationId}/members`;
  const { data: membersData } = useSWR<OrgMember[]>(membersUrl, fetcher);

  const handleLink = useCallback(
    async (externalId: string, userId: string) => {
      setLinkingUser(externalId);
      try {
        const res = await fetch(`/api/content/sources/${sourceId}/users/${encodeURIComponent(externalId)}/link`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });

        if (!res.ok) {
          throw new Error('Failed to link user');
        }

        // Refresh the users list
        await mutate(usersUrl);
      } catch (error) {
        logger.error('Failed to link user', error);
      } finally {
        setLinkingUser(null);
      }
    },
    [sourceId, usersUrl],
  );

  const handleUnlink = useCallback(
    async (externalId: string) => {
      setLinkingUser(externalId);
      try {
        const res = await fetch(`/api/content/sources/${sourceId}/users/${encodeURIComponent(externalId)}/link`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          throw new Error('Failed to unlink user');
        }

        // Refresh the users list
        await mutate(usersUrl);
      } catch (error) {
        logger.error('Failed to unlink user', error);
      } finally {
        setLinkingUser(null);
      }
    },
    [sourceId, usersUrl],
  );

  if (usersLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-32" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (usersError) {
    return (
      <div className={cn('flex items-center gap-2 p-4 text-destructive', className)}>
        <AlertCircle className="h-5 w-5" />
        <span>Failed to load users. Please try again.</span>
      </div>
    );
  }

  const users = usersData?.users || [];

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="font-medium">User Mapping</h3>
          <p className="text-sm text-muted-foreground">
            Link external users to organization members for better attribution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{usersData?.linked || 0} linked</Badge>
          <Badge variant="outline">{usersData?.unlinked || 0} unlinked</Badge>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        <Button variant={filter === 'unlinked' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('unlinked')}>
          <Link2Off className="h-4 w-4 mr-1" />
          Unlinked
        </Button>
        <Button variant={filter === 'linked' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('linked')}>
          <Link2 className="h-4 w-4 mr-1" />
          Linked
        </Button>
        <Button variant={filter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setFilter('all')}>
          All
        </Button>
      </div>

      {/* Users list */}
      <ScrollArea className="h-100">
        <div className="space-y-2 pr-4">
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <User className="h-10 w-10 mb-2 opacity-50" />
              <p>No {filter === 'all' ? '' : filter} users found</p>
            </div>
          ) : (
            users.map((user) => (
              <UserLinkingRow
                key={user.externalId}
                user={user}
                members={membersData || []}
                isLinking={linkingUser === user.externalId}
                onLink={(userId) => handleLink(user.externalId, userId)}
                onUnlink={() => handleUnlink(user.externalId)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// =============================================================================
// User Row Component
// =============================================================================

interface UserLinkingRowProps {
  user: ExternalUser;
  members: OrgMember[];
  isLinking: boolean;
  onLink: (userId: string) => void;
  onUnlink: () => void;
}

function UserLinkingRow({ user, members, isLinking, onLink, onUnlink }: UserLinkingRowProps) {
  const [open, setOpen] = useState(false);

  const isLinked = user.linkedUserId !== null;

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback>{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium text-sm">{user.name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {user.email && <span>{user.email}</span>}
            <Badge variant="outline" className="text-xs">
              {user.itemCount} item{user.itemCount !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isLinked ? (
          // Show linked user and unlink button
          <>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted">
              <Avatar className="h-6 w-6">
                <AvatarImage src={user.linkedUserImage || undefined} alt={user.linkedUserName || ''} />
                <AvatarFallback className="text-xs">
                  {user.linkedUserName?.slice(0, 2).toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{user.linkedUserName}</span>
              <Check className="h-4 w-4 text-green-500" />
            </div>
            <Button variant="ghost" size="sm" onClick={onUnlink} disabled={isLinking}>
              {isLinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2Off className="h-4 w-4" />}
            </Button>
          </>
        ) : (
          // Show link dropdown
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" disabled={isLinking}>
                {isLinking ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Link2 className="h-4 w-4 mr-1" />}
                Link
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-70" align="end">
              <Command>
                <CommandInput placeholder="Search members..." />
                <CommandList>
                  <CommandEmpty>No members found.</CommandEmpty>

                  {/* Suggestions first */}
                  {user.suggestions.length > 0 && (
                    <CommandGroup heading="Suggested">
                      {user.suggestions.map((suggestion) => (
                        <CommandItem
                          key={suggestion.userId}
                          onSelect={() => {
                            onLink(suggestion.userId);
                            setOpen(false);
                          }}
                        >
                          <Avatar className="h-6 w-6 mr-2">
                            <AvatarImage src={suggestion.image || undefined} alt={suggestion.name || ''} />
                            <AvatarFallback className="text-xs">
                              {suggestion.name?.slice(0, 2).toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm">{suggestion.name}</p>
                            <p className="text-xs text-muted-foreground">{suggestion.reason}</p>
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            {Math.round(suggestion.confidence * 100)}%
                          </Badge>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {/* All members */}
                  <CommandGroup heading="All Members">
                    {members.map((member) => (
                      <CommandItem
                        key={member.userId}
                        onSelect={() => {
                          onLink(member.userId);
                          setOpen(false);
                        }}
                      >
                        <Avatar className="h-6 w-6 mr-2">
                          <AvatarImage src={member.user.image || undefined} alt={member.user.name || ''} />
                          <AvatarFallback className="text-xs">
                            {member.user.name?.slice(0, 2).toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm">{member.user.name}</p>
                          <p className="text-xs text-muted-foreground">{member.user.email}</p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}

export default UserLinkingPanel;
