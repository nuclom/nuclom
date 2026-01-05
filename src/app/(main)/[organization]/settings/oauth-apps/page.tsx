"use client";

import { Check, Copy, ExternalLink, Eye, EyeOff, Globe, Loader2, Plus, Settings2, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/auth-guard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type OAuthApp = {
  id: string;
  name?: string | null;
  icon?: string | null;
  clientId?: string | null;
  clientSecret?: string | null;
  redirectUrls?: string | null;
  type?: string | null;
  disabled?: boolean | null;
  createdAt?: Date | null;
};

type AuthorizedApp = {
  id: string;
  clientId?: string | null;
  scopes?: string | null;
  createdAt?: Date | null;
};

function OAuthAppsContent() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [myApps, setMyApps] = useState<OAuthApp[]>([]);
  const [authorizedApps, setAuthorizedApps] = useState<AuthorizedApp[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<OAuthApp | null>(null);
  const [appToDelete, setAppToDelete] = useState<OAuthApp | null>(null);
  const [revokeApp, setRevokeApp] = useState<AuthorizedApp | null>(null);

  // Form state
  const [appName, setAppName] = useState("");
  const [appIcon, setAppIcon] = useState("");
  const [redirectUrls, setRedirectUrls] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [revoking, setRevoking] = useState(false);

  // Secret visibility
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState<"id" | "secret" | null>(null);

  // Newly created app with secret
  const [newApp, setNewApp] = useState<OAuthApp | null>(null);

  const loadOAuthApps = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch user's created OAuth apps via API
      const appsResponse = await fetch("/api/oauth/applications");
      if (appsResponse.ok) {
        const apps = await appsResponse.json();
        setMyApps(apps || []);
      }

      // Fetch authorized apps (apps the user has granted access to)
      const consentsResponse = await fetch("/api/oauth/consents");
      if (consentsResponse.ok) {
        const consents = await consentsResponse.json();
        setAuthorizedApps(consents || []);
      }
    } catch (error) {
      console.error("Error loading OAuth apps:", error);
      toast({
        title: "Error",
        description: "Failed to load OAuth applications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadOAuthApps();
  }, [loadOAuthApps]);

  const handleCreateApp = async () => {
    if (!appName.trim()) {
      toast({
        title: "Error",
        description: "Application name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const response = await fetch("/api/oauth/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: appName,
          icon: appIcon || undefined,
          redirectUrls: redirectUrls
            .split("\n")
            .map((url) => url.trim())
            .filter(Boolean),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create application");
      }

      const createdApp = await response.json();
      setNewApp(createdApp);
      toast({
        title: "Application created",
        description: "Your OAuth application has been created. Save the client secret - you won't see it again!",
      });
      await loadOAuthApps();
    } catch (error) {
      console.error("Error creating OAuth app:", error);
      toast({
        title: "Error",
        description: "Failed to create OAuth application",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateApp = async () => {
    if (!editingApp) return;

    try {
      setSaving(true);
      const response = await fetch(`/api/oauth/applications/${editingApp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: appName,
          icon: appIcon || undefined,
          redirectUrls: redirectUrls
            .split("\n")
            .map((url) => url.trim())
            .filter(Boolean),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update application");
      }

      toast({
        title: "Application updated",
        description: "Your OAuth application has been updated",
      });
      setEditingApp(null);
      resetForm();
      await loadOAuthApps();
    } catch (error) {
      console.error("Error updating OAuth app:", error);
      toast({
        title: "Error",
        description: "Failed to update OAuth application",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteApp = async () => {
    if (!appToDelete) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/oauth/applications/${appToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete application");
      }

      toast({
        title: "Application deleted",
        description: "The OAuth application has been deleted",
      });
      setAppToDelete(null);
      await loadOAuthApps();
    } catch (error) {
      console.error("Error deleting OAuth app:", error);
      toast({
        title: "Error",
        description: "Failed to delete OAuth application",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleRevokeConsent = async () => {
    if (!revokeApp) return;

    try {
      setRevoking(true);
      const response = await fetch(`/api/oauth/consents/${revokeApp.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to revoke access");
      }

      toast({
        title: "Access revoked",
        description: "The application no longer has access to your account",
      });
      setRevokeApp(null);
      await loadOAuthApps();
    } catch (error) {
      console.error("Error revoking consent:", error);
      toast({
        title: "Error",
        description: "Failed to revoke application access",
        variant: "destructive",
      });
    } finally {
      setRevoking(false);
    }
  };

  const handleCopy = async (text: string, type: "id" | "secret") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
    toast({
      title: "Copied",
      description: `${type === "id" ? "Client ID" : "Client Secret"} copied to clipboard`,
    });
  };

  const resetForm = () => {
    setAppName("");
    setAppIcon("");
    setRedirectUrls("");
    setShowSecret(false);
  };

  const openEditDialog = (app: OAuthApp) => {
    setEditingApp(app);
    setAppName(app.name || "");
    setAppIcon(app.icon || "");
    setRedirectUrls(app.redirectUrls || "");
  };

  const closeCreateDialog = () => {
    setCreateDialogOpen(false);
    setNewApp(null);
    resetForm();
  };

  const parseScopes = (scopes?: string | null): string[] => {
    if (!scopes) return [];
    return scopes.split(" ").filter(Boolean);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            OAuth Applications
          </CardTitle>
          <CardDescription>Loading OAuth applications...</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Your OAuth Applications */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Your OAuth Applications
            </CardTitle>
            <CardDescription>Create and manage OAuth applications to integrate with Nuclom</CardDescription>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Application
          </Button>
        </CardHeader>
        <CardContent>
          {myApps.length === 0 ? (
            <div className="text-center py-8">
              <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No OAuth applications</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create an OAuth application to allow other services to integrate with Nuclom
              </p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create your first application
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {myApps.map((app) => (
                <div key={app.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={app.icon || undefined} />
                      <AvatarFallback>{(app.name || "A").charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{app.name || "Unnamed App"}</h3>
                        {app.disabled && <Badge variant="secondary">Disabled</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">Client ID: {app.clientId || "N/A"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => openEditDialog(app)}>
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setAppToDelete(app)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Authorized Applications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Authorized Applications
          </CardTitle>
          <CardDescription>Applications you&apos;ve granted access to your Nuclom account</CardDescription>
        </CardHeader>
        <CardContent>
          {authorizedApps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No applications have been granted access to your account
            </p>
          ) : (
            <div className="space-y-4">
              {authorizedApps.map((consent) => (
                <div key={consent.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">App: {consent.clientId || "Unknown"}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {parseScopes(consent.scopes).map((scope) => (
                        <Badge key={scope} variant="outline" className="text-xs">
                          {scope}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Authorized: {consent.createdAt ? new Date(consent.createdAt).toLocaleDateString() : "Unknown"}
                    </p>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => setRevokeApp(consent)}>
                    Revoke
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* OAuth Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>OAuth 2.0 / OpenID Connect</CardTitle>
          <CardDescription>Use OAuth 2.0 to build integrations with Nuclom</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Authorization Endpoint</h4>
            <code className="block bg-muted p-2 rounded text-sm">
              {typeof window !== "undefined" ? window.location.origin : ""}/api/auth/oauth2/authorize
            </code>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Token Endpoint</h4>
            <code className="block bg-muted p-2 rounded text-sm">
              {typeof window !== "undefined" ? window.location.origin : ""}/api/auth/oauth2/token
            </code>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Supported Scopes</h4>
            <div className="flex flex-wrap gap-2">
              {["openid", "profile", "email", "offline_access"].map((scope) => (
                <Badge key={scope} variant="outline">
                  {scope}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog
        open={createDialogOpen || !!editingApp}
        onOpenChange={(open) => {
          if (!open) {
            setCreateDialogOpen(false);
            setEditingApp(null);
            setNewApp(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {newApp ? "Application Created" : editingApp ? "Edit Application" : "Create OAuth Application"}
            </DialogTitle>
            <DialogDescription>
              {newApp
                ? "Save your client credentials. You won't see the secret again!"
                : editingApp
                  ? "Update your OAuth application settings"
                  : "Create a new OAuth application for external integrations"}
            </DialogDescription>
          </DialogHeader>

          {newApp ? (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  Save your client secret now. You won&apos;t be able to see it again!
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Client ID</Label>
                <div className="flex items-center gap-2">
                  <Input value={newApp.clientId || ""} readOnly className="font-mono" />
                  <Button variant="outline" size="icon" onClick={() => handleCopy(newApp.clientId || "", "id")}>
                    {copied === "id" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Client Secret</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type={showSecret ? "text" : "password"}
                    value={newApp.clientSecret || ""}
                    readOnly
                    className="font-mono"
                  />
                  <Button variant="outline" size="icon" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => handleCopy(newApp.clientSecret || "", "secret")}>
                    {copied === "secret" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button onClick={closeCreateDialog}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="appName">Application Name</Label>
                <Input
                  id="appName"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="My Integration"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appIcon">Icon URL (optional)</Label>
                <Input
                  id="appIcon"
                  type="url"
                  value={appIcon}
                  onChange={(e) => setAppIcon(e.target.value)}
                  placeholder="https://example.com/icon.png"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="redirectUrls">Redirect URLs</Label>
                <Textarea
                  id="redirectUrls"
                  value={redirectUrls}
                  onChange={(e) => setRedirectUrls(e.target.value)}
                  placeholder="https://example.com/callback&#10;https://localhost:3000/callback"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">Enter one URL per line</p>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCreateDialogOpen(false);
                    setEditingApp(null);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={editingApp ? handleUpdateApp : handleCreateApp} disabled={saving}>
                  {saving ? "Saving..." : editingApp ? "Update" : "Create Application"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!appToDelete} onOpenChange={() => setAppToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete OAuth Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this application? All users who have authorized this app will lose access.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {appToDelete && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{appToDelete.name || "Unnamed App"}</p>
                <p className="text-sm text-muted-foreground">Client ID: {appToDelete.clientId || "N/A"}</p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setAppToDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteApp} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete Application"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Revoke Consent Dialog */}
      <Dialog open={!!revokeApp} onOpenChange={() => setRevokeApp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke Application Access</DialogTitle>
            <DialogDescription>
              Are you sure you want to revoke this application&apos;s access to your account?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeApp(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevokeConsent} disabled={revoking}>
              {revoking ? "Revoking..." : "Revoke Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function OAuthAppsSettingsPage() {
  return (
    <RequireAuth>
      <OAuthAppsContent />
    </RequireAuth>
  );
}
