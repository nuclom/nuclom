'use client';

/**
 * Content Sources Manager Component
 *
 * Manages content source connections for knowledge import (Slack, Notion, GitHub).
 */

import { logger } from '@nuclom/lib/client-logger';
import { BookOpen, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  AddContentSourceCard,
  type ContentSource,
  ContentSourceCard,
  type ContentSourceType,
  GitHubIcon,
  NotionIcon,
  SlackIcon,
} from '@/components/integrations/content-source-card';
import { GitHubRepoSelector } from '@/components/integrations/github-repo-selector';
import { NotionPageSelector } from '@/components/integrations/notion-page-selector';
import { UserLinkingPanel } from '@/components/integrations/user-linking-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

// =============================================================================
// Types
// =============================================================================

export interface ContentSourcesManagerProps {
  organizationId: string;
}

// Helper to safely extract string arrays from config
function getConfigStringArray(config: unknown, key: string): string[] {
  if (typeof config !== 'object' || config === null) return [];
  const value = (config as Record<string, unknown>)[key];
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
    return value;
  }
  return [];
}

// =============================================================================
// Component
// =============================================================================

export function ContentSourcesManager({ organizationId }: ContentSourcesManagerProps) {
  const { toast } = useToast();
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [configureSourceId, setConfigureSourceId] = useState<string | null>(null);

  // Load content sources
  const loadSources = useCallback(async () => {
    try {
      const response = await fetch(`/api/content/sources?organizationId=${organizationId}`);
      if (response.ok) {
        const data = await response.json();
        setSources(data.items || []);
      }
    } catch (error) {
      logger.error('Failed to load content sources', error);
      toast({
        title: 'Error',
        description: 'Failed to load content sources',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId, toast]);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  // Refresh sources
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSources();
    setRefreshing(false);
  };

  // Connect a new source
  const handleConnect = (type: ContentSourceType) => {
    // Redirect to OAuth authorization
    const endpoints: Record<ContentSourceType, string> = {
      slack: `/api/content/slack/authorize?organizationId=${organizationId}`,
      notion: `/api/content/notion/authorize?organizationId=${organizationId}`,
      github: `/api/content/github/authorize?organizationId=${organizationId}`,
    };

    window.location.href = endpoints[type];
  };

  // Sync a source
  const handleSync = async (sourceId: string) => {
    const response = await fetch(`/api/content/sources/${sourceId}/sync`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error('Failed to start sync');
    }

    // Refresh after starting sync
    await loadSources();
  };

  // Delete a source
  const handleDelete = async (sourceId: string) => {
    const response = await fetch(`/api/content/sources/${sourceId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error('Failed to delete source');
    }

    // Remove from state
    setSources((prev) => prev.filter((s) => s.id !== sourceId));
  };

  // Configure a source
  const handleConfigure = (sourceId: string) => {
    setConfigureSourceId(sourceId);
    setShowConfigDialog(true);
  };

  // Get sources by type
  const getSourcesByType = (type: ContentSourceType) => sources.filter((s) => s.type === type);

  // Check if a type is connected
  const isTypeConnected = (type: ContentSourceType) => sources.some((s) => s.type === type);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Content Sources</h2>
            <p className="text-muted-foreground text-sm">
              Connect knowledge sources to build your team's knowledge base
            </p>
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-muted rounded-xl animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-32 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-16 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Content Sources</h2>
          <p className="text-muted-foreground text-sm">Connect knowledge sources to build your team's knowledge base</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Summary */}
      {sources.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{sources.length}</div>
                <div className="text-sm text-muted-foreground">Connected Sources</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-green-600">
                  {sources.reduce((sum, s) => sum + s.itemCount, 0).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Total Items</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-blue-600">
                  {sources.reduce((sum, s) => sum + s.pendingCount, 0).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Processing</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-red-600">
                  {sources.reduce((sum, s) => sum + s.failedCount, 0).toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Source Cards */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Sources</TabsTrigger>
          <TabsTrigger value="slack" className="gap-2">
            <SlackIcon className="h-4 w-4" />
            Slack
          </TabsTrigger>
          <TabsTrigger value="notion" className="gap-2">
            <NotionIcon className="h-4 w-4" />
            Notion
          </TabsTrigger>
          <TabsTrigger value="github" className="gap-2">
            <GitHubIcon className="h-4 w-4" />
            GitHub
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Connected sources */}
            {sources.map((source) => (
              <ContentSourceCard
                key={source.id}
                source={source}
                onSync={handleSync}
                onDelete={handleDelete}
                onConfigure={handleConfigure}
              />
            ))}

            {/* Add new source cards for unconnected types */}
            {!isTypeConnected('slack') && <AddContentSourceCard type="slack" onConnect={handleConnect} />}
            {!isTypeConnected('notion') && <AddContentSourceCard type="notion" onConnect={handleConnect} />}
            {!isTypeConnected('github') && <AddContentSourceCard type="github" onConnect={handleConnect} />}

            {/* Empty state if all connected */}
            {sources.length === 3 &&
              isTypeConnected('slack') &&
              isTypeConnected('notion') &&
              isTypeConnected('github') && (
                <Card className="overflow-hidden border-dashed">
                  <CardContent className="py-8 flex flex-col items-center justify-center text-center">
                    <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="font-medium">All sources connected</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      You've connected all available content sources.
                    </p>
                  </CardContent>
                </Card>
              )}
          </div>
        </TabsContent>

        <TabsContent value="slack" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {getSourcesByType('slack').map((source) => (
              <ContentSourceCard
                key={source.id}
                source={source}
                onSync={handleSync}
                onDelete={handleDelete}
                onConfigure={handleConfigure}
              />
            ))}
            {!isTypeConnected('slack') && <AddContentSourceCard type="slack" onConnect={handleConnect} />}
          </div>
        </TabsContent>

        <TabsContent value="notion" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {getSourcesByType('notion').map((source) => (
              <ContentSourceCard
                key={source.id}
                source={source}
                onSync={handleSync}
                onDelete={handleDelete}
                onConfigure={handleConfigure}
              />
            ))}
            {!isTypeConnected('notion') && <AddContentSourceCard type="notion" onConnect={handleConnect} />}
          </div>
        </TabsContent>

        <TabsContent value="github" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {getSourcesByType('github').map((source) => (
              <ContentSourceCard
                key={source.id}
                source={source}
                onSync={handleSync}
                onDelete={handleDelete}
                onConfigure={handleConfigure}
              />
            ))}
            {!isTypeConnected('github') && <AddContentSourceCard type="github" onConnect={handleConnect} />}
          </div>
        </TabsContent>
      </Tabs>

      {/* Empty State */}
      {sources.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 flex flex-col items-center justify-center text-center">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <BookOpen className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-lg mb-2">No content sources connected</CardTitle>
            <CardDescription className="max-w-md">
              Connect your team's communication and documentation tools to build a unified knowledge base.
            </CardDescription>
            <div className="flex gap-2 mt-6">
              <Button onClick={() => handleConnect('slack')}>
                <SlackIcon className="h-4 w-4 mr-2" />
                Connect Slack
              </Button>
              <Button variant="outline" onClick={() => handleConnect('notion')}>
                <NotionIcon className="h-4 w-4 mr-2" />
                Connect Notion
              </Button>
              <Button variant="outline" onClick={() => handleConnect('github')}>
                <GitHubIcon className="h-4 w-4 mr-2" />
                Connect GitHub
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Dialog */}
      <ContentSourceConfigDialog
        open={showConfigDialog}
        onClose={() => {
          setShowConfigDialog(false);
          setConfigureSourceId(null);
        }}
        sourceId={configureSourceId}
        source={sources.find((s) => s.id === configureSourceId)}
        organizationId={organizationId}
        onSave={async (config) => {
          if (!configureSourceId) return;

          const response = await fetch(`/api/content/sources/${configureSourceId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
          });

          if (!response.ok) {
            throw new Error('Failed to save configuration');
          }

          toast({
            title: 'Configuration Saved',
            description: 'Source configuration has been updated.',
          });

          await loadSources();
          setShowConfigDialog(false);
          setConfigureSourceId(null);
        }}
      />
    </div>
  );
}

// =============================================================================
// Configuration Dialog
// =============================================================================

interface ContentSourceConfigDialogProps {
  open: boolean;
  onClose: () => void;
  sourceId: string | null;
  source?: ContentSource;
  organizationId: string;
  onSave: (config: Record<string, unknown>) => Promise<void>;
}

function ContentSourceConfigDialog({
  open,
  onClose,
  sourceId,
  source,
  organizationId,
  onSave,
}: ContentSourceConfigDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [channels, setChannels] = useState('');
  const [databases, setDatabases] = useState('');
  const [repositories, setRepositories] = useState('');

  // Reset form when source changes
  useEffect(() => {
    if (source) {
      setName(source.name);
      setChannels(getConfigStringArray(source.config, 'channels').join(', '));
      setDatabases(getConfigStringArray(source.config, 'databases').join(', '));
      setRepositories(getConfigStringArray(source.config, 'repositories').join(', '));
    }
  }, [source]);

  const handleSave = async () => {
    try {
      setSaving(true);

      const config: Record<string, unknown> = { name };

      if (source?.type === 'slack' && channels.trim()) {
        config.channels = channels
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean);
      }
      if (source?.type === 'notion' && databases.trim()) {
        config.databases = databases
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean);
      }
      if (source?.type === 'github' && repositories.trim()) {
        config.repositories = repositories
          .split(',')
          .map((r) => r.trim())
          .filter(Boolean);
      }

      await onSave(config);
    } catch (error) {
      logger.error('Failed to save configuration', error);
      toast({
        title: 'Error',
        description: 'Failed to save configuration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!source) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-150">
        <DialogHeader>
          <DialogTitle>
            Configure {source.type === 'slack' ? 'Slack' : source.type === 'notion' ? 'Notion' : 'GitHub'}
          </DialogTitle>
          <DialogDescription>Customize what content to sync from this source</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="users">User Mapping</TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Source Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Workspace" />
            </div>

            {source.type === 'slack' && (
              <div className="space-y-2">
                <Label htmlFor="channels">Channels to Sync</Label>
                <Input
                  id="channels"
                  value={channels}
                  onChange={(e) => setChannels(e.target.value)}
                  placeholder="general, engineering, product"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of channel names. Leave empty to sync all accessible channels.
                </p>
              </div>
            )}

            {source.type === 'notion' && (
              <div className="space-y-4">
                <NotionPageSelector
                  sourceId={source.id}
                  onSave={() => {
                    // Refresh sources after saving selection
                  }}
                />
                <div className="space-y-2">
                  <Label htmlFor="databases">Additional Database IDs</Label>
                  <Input
                    id="databases"
                    value={databases}
                    onChange={(e) => setDatabases(e.target.value)}
                    placeholder="Optional: Additional database IDs"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optionally add database IDs not shown in the tree above.
                  </p>
                </div>
              </div>
            )}

            {source.type === 'github' && (
              <div className="space-y-4">
                <GitHubRepoSelector
                  sourceId={source.id}
                  onSave={() => {
                    // Refresh sources after saving selection
                  }}
                />
                <div className="space-y-2">
                  <Label htmlFor="repositories">Additional Repositories</Label>
                  <Input
                    id="repositories"
                    value={repositories}
                    onChange={(e) => setRepositories(e.target.value)}
                    placeholder="Optional: owner/repo, org/another-repo"
                  />
                  <p className="text-xs text-muted-foreground">
                    Optionally add repositories not shown in the list above.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Configuration'
                )}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="users" className="py-4">
            {sourceId && <UserLinkingPanel sourceId={sourceId} organizationId={organizationId} />}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export default ContentSourcesManager;
