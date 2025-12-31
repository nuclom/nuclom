"use client";

import { Check, Copy, Eye, EyeOff, Key, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/auth-guard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { authClient } from "@/lib/auth-client";

type ApiKey = {
  id: string;
  name?: string | null;
  start?: string | null;
  prefix?: string | null;
  enabled?: boolean | null;
  expiresAt?: Date | null;
  createdAt: Date;
  lastRequest?: Date | null;
  requestCount?: number | null;
  rateLimitMax?: number | null;
};

function ApiKeysContent() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpiration, setNewKeyExpiration] = useState("30");
  const [creating, setCreating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadApiKeys = useCallback(async () => {
    try {
      setLoading(true);
      // Use fetch directly since the client doesn't expose listApiKeys
      const response = await fetch("/api/auth/api-key/list", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data as ApiKey[]);
      }
    } catch (error) {
      console.error("Error loading API keys:", error);
      toast({
        title: "Error",
        description: "Failed to load API keys",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  const handleCreateKey = async () => {
    try {
      setCreating(true);
      const expirationDays = parseInt(newKeyExpiration);
      const expiresIn = expirationDays > 0 ? expirationDays * 24 * 60 * 60 : undefined;

      const { data, error } = await authClient.apiKey.create({
        name: newKeyName || undefined,
        expiresIn,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to create API key",
          variant: "destructive",
        });
        return;
      }

      if (data) {
        setNewlyCreatedKey((data as { key?: string }).key || null);
        setShowNewKey(true);
        toast({
          title: "API key created",
          description: "Your new API key has been created. Copy it now - you won't see it again!",
        });
        await loadApiKeys();
      }
    } catch (error) {
      console.error("Error creating API key:", error);
      toast({
        title: "Error",
        description: "Failed to create API key",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleCopyKey = async () => {
    if (newlyCreatedKey) {
      await navigator.clipboard.writeText(newlyCreatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied",
        description: "API key copied to clipboard",
      });
    }
  };

  const handleDeleteKey = async () => {
    if (!keyToDelete) return;
    try {
      setDeleting(true);
      const { error } = await authClient.apiKey.delete({
        keyId: keyToDelete.id,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to delete API key",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "API key deleted",
        description: "The API key has been permanently deleted",
      });
      setKeyToDelete(null);
      await loadApiKeys();
    } catch (error) {
      console.error("Error deleting API key:", error);
      toast({
        title: "Error",
        description: "Failed to delete API key",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const closeNewKeyDialog = () => {
    setCreateDialogOpen(false);
    setNewlyCreatedKey(null);
    setShowNewKey(false);
    setNewKeyName("");
    setNewKeyExpiration("30");
  };

  const formatDate = (date: Date | null | undefined) => {
    if (!date) return "Never";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const isExpired = (expiresAt: Date | null | undefined) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Keys
          </CardTitle>
          <CardDescription>Loading API keys...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys
            </CardTitle>
            <CardDescription>Manage API keys for programmatic access to your account</CardDescription>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create API Key
          </Button>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No API keys</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create an API key to access the Nuclom API programmatically
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create your first API key
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name || "Unnamed key"}</TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {key.prefix || "nc_"}...{key.start || "****"}
                      </code>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(key.createdAt)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {key.expiresAt ? formatDate(key.expiresAt) : "Never"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {key.lastRequest ? formatDate(key.lastRequest) : "Never"}
                    </TableCell>
                    <TableCell>
                      {!key.enabled ? (
                        <Badge variant="secondary">Disabled</Badge>
                      ) : isExpired(key.expiresAt) ? (
                        <Badge variant="destructive">Expired</Badge>
                      ) : (
                        <Badge variant="default">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setKeyToDelete(key)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        <CardFooter className="bg-muted/50 border-t px-6 py-4">
          <p className="text-sm text-muted-foreground">
            API keys provide full access to your account. Keep them secure and never share them publicly.
          </p>
        </CardFooter>
      </Card>

      {/* API Documentation Link */}
      <Card>
        <CardHeader>
          <CardTitle>API Documentation</CardTitle>
          <CardDescription>Learn how to use the Nuclom API</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Use your API key in the <code className="bg-muted px-1 rounded">x-api-key</code> header when making
            requests.
          </p>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
            <pre>{`curl -X GET "https://api.nuclom.com/v1/videos" \\
  -H "x-api-key: nc_your_api_key_here"`}</pre>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/50 border-t px-6 py-4">
          <Button variant="outline" asChild>
            <a href="/docs/api" target="_blank" rel="noopener noreferrer">
              View API Documentation
            </a>
          </Button>
        </CardFooter>
      </Card>

      {/* Create API Key Dialog */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeNewKeyDialog();
          else setCreateDialogOpen(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newlyCreatedKey ? "API Key Created" : "Create API Key"}</DialogTitle>
            <DialogDescription>
              {newlyCreatedKey
                ? "Copy your new API key. You won't be able to see it again!"
                : "Create a new API key for programmatic access"}
            </DialogDescription>
          </DialogHeader>

          {newlyCreatedKey ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Make sure to copy your API key now. You won&apos;t be able to see it again!
                </AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Label>Your API Key</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type={showNewKey ? "text" : "password"}
                    value={newlyCreatedKey}
                    readOnly
                    className="font-mono"
                  />
                  <Button variant="outline" size="icon" onClick={() => setShowNewKey(!showNewKey)}>
                    {showNewKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleCopyKey}>
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={closeNewKeyDialog}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="keyName">Name (optional)</Label>
                <Input
                  id="keyName"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Production API"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiration">Expiration</Label>
                <Select value={newKeyExpiration} onValueChange={setNewKeyExpiration}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select expiration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                    <SelectItem value="0">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeNewKeyDialog}>
                  Cancel
                </Button>
                <Button onClick={handleCreateKey} disabled={creating}>
                  {creating ? "Creating..." : "Create Key"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!keyToDelete} onOpenChange={() => setKeyToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete API Key</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this API key? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {keyToDelete && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{keyToDelete.name || "Unnamed key"}</p>
                <p className="text-sm text-muted-foreground">
                  {keyToDelete.prefix || "nc_"}...{keyToDelete.start || "****"}
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setKeyToDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteKey} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete Key"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ApiKeysSettingsPage() {
  return (
    <RequireAuth>
      <ApiKeysContent />
    </RequireAuth>
  );
}
