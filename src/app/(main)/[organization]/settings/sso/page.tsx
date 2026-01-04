"use client";

import { AlertCircle, Check, Copy, Key, Loader2, Lock, Plus, RefreshCw, Settings, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/auth/auth-guard";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type SSOConfig = {
  id: string;
  providerType: "saml" | "oidc";
  enabled: boolean;
  entityId?: string;
  ssoUrl?: string;
  sloUrl?: string;
  certificate?: string;
  issuer?: string;
  clientId?: string;
  clientSecret?: string;
  discoveryUrl?: string;
  autoProvision: boolean;
  defaultRole: "owner" | "member";
  allowedDomains?: string[];
  attributeMapping?: {
    email?: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    groups?: string;
  };
};

function SSOContent() {
  const params = useParams();
  const organizationId = params.organization as string;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<SSOConfig | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; errors: string[] } | null>(null);

  // Form state
  const [providerType, setProviderType] = useState<"saml" | "oidc">("saml");
  const [entityId, setEntityId] = useState("");
  const [ssoUrl, setSsoUrl] = useState("");
  const [sloUrl, setSloUrl] = useState("");
  const [certificate, setCertificate] = useState("");
  const [issuer, setIssuer] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [discoveryUrl, setDiscoveryUrl] = useState("");
  const [autoProvision, setAutoProvision] = useState(true);
  const [defaultRole, setDefaultRole] = useState<"owner" | "member">("member");
  const [allowedDomains, setAllowedDomains] = useState("");

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/organizations/${organizationId}/sso`);
      const data = await response.json();

      if (data.success && data.data) {
        setConfig(data.data);
        // Pre-fill form
        setProviderType(data.data.providerType);
        setEntityId(data.data.entityId || "");
        setSsoUrl(data.data.ssoUrl || "");
        setSloUrl(data.data.sloUrl || "");
        setCertificate(data.data.certificate || "");
        setIssuer(data.data.issuer || "");
        setClientId(data.data.clientId || "");
        setClientSecret("");
        setDiscoveryUrl(data.data.discoveryUrl || "");
        setAutoProvision(data.data.autoProvision);
        setDefaultRole(data.data.defaultRole);
        setAllowedDomains(data.data.allowedDomains?.join(", ") || "");
      }
    } catch (error) {
      console.error("Error loading SSO config:", error);
      toast({
        title: "Error",
        description: "Failed to load SSO configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId, toast]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSaveConfig = async () => {
    try {
      setSaving(true);

      const configData =
        providerType === "saml"
          ? { entityId, ssoUrl, sloUrl, certificate }
          : { issuer, clientId, clientSecret, discoveryUrl };

      const response = await fetch(`/api/organizations/${organizationId}/sso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerType,
          config: configData,
          options: {
            autoProvision,
            defaultRole,
            allowedDomains: allowedDomains
              .split(",")
              .map((d) => d.trim())
              .filter(Boolean),
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Configuration saved",
          description: "SSO configuration has been saved. Test the configuration before enabling.",
        });
        setConfigDialogOpen(false);
        await loadConfig();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Error saving SSO config:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save configuration",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConfig = async () => {
    try {
      setTesting(true);
      setTestResult(null);

      // First save the config
      await handleSaveConfig();

      // Then test it
      const response = await fetch(`/api/organizations/${organizationId}/sso/test`, {
        method: "POST",
      });

      const data = await response.json();
      setTestResult(data.data || { valid: false, errors: [data.error] });
    } catch (error) {
      console.error("Error testing SSO config:", error);
      setTestResult({
        valid: false,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
    } finally {
      setTesting(false);
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    try {
      const response = await fetch(`/api/organizations/${organizationId}/sso`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: enabled ? "SSO Enabled" : "SSO Disabled",
          description: enabled
            ? "Users can now sign in using SSO"
            : "SSO has been disabled. Users must use email/password.",
        });
        await loadConfig();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Error toggling SSO:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update SSO status",
        variant: "destructive",
      });
    }
  };

  const handleDeleteConfig = async () => {
    try {
      const response = await fetch(`/api/organizations/${organizationId}/sso`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "SSO Deleted",
          description: "SSO configuration has been removed",
        });
        setConfig(null);
        setDeleteDialogOpen(false);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Error deleting SSO config:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete configuration",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Single Sign-On</CardTitle>
            <CardDescription>Loading SSO configuration...</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Single Sign-On (SSO)
              </CardTitle>
              <CardDescription>Configure SAML 2.0 or OIDC authentication for your organization</CardDescription>
            </div>
            {config && (
              <Badge variant={config.enabled ? "default" : "secondary"}>
                {config.enabled ? "Enabled" : "Disabled"}
              </Badge>
            )}
          </div>
        </CardHeader>
        {!config && (
          <CardContent>
            <div className="text-center py-8">
              <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No SSO Configured</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Set up SAML or OIDC authentication to allow team members to sign in with their corporate identity
                provider.
              </p>
              <Button onClick={() => setConfigDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Configure SSO
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {config && (
        <>
          {/* Configuration Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Provider Type</p>
                  <p className="text-sm text-muted-foreground">
                    {config.providerType === "saml" ? "SAML 2.0" : "OpenID Connect"}
                  </p>
                </div>
                <Badge variant="outline">{config.providerType.toUpperCase()}</Badge>
              </div>

              {config.providerType === "saml" && (
                <>
                  <div className="p-4 border rounded-lg space-y-2">
                    <p className="font-medium">Identity Provider</p>
                    <p className="text-sm text-muted-foreground break-all">{config.ssoUrl}</p>
                  </div>
                  <div className="p-4 border rounded-lg space-y-2">
                    <p className="font-medium">Entity ID</p>
                    <p className="text-sm text-muted-foreground break-all">{config.entityId}</p>
                  </div>
                </>
              )}

              {config.providerType === "oidc" && (
                <>
                  <div className="p-4 border rounded-lg space-y-2">
                    <p className="font-medium">Issuer</p>
                    <p className="text-sm text-muted-foreground break-all">{config.issuer}</p>
                  </div>
                  <div className="p-4 border rounded-lg space-y-2">
                    <p className="font-medium">Client ID</p>
                    <p className="text-sm text-muted-foreground break-all">{config.clientId}</p>
                  </div>
                </>
              )}

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Auto-Provisioning</p>
                  <p className="text-sm text-muted-foreground">
                    {config.autoProvision ? "New users are automatically created" : "Users must be pre-created"}
                  </p>
                </div>
                <Badge variant={config.autoProvision ? "default" : "secondary"}>
                  {config.autoProvision ? "On" : "Off"}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Default Role</p>
                  <p className="text-sm text-muted-foreground">New users get this role when joining via SSO</p>
                </div>
                <Badge variant="outline">{config.defaultRole}</Badge>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/50 border-t px-6 py-4 flex justify-between">
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setConfigDialogOpen(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button variant="outline" onClick={handleTestConfig} disabled={testing}>
                  {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Test
                </Button>
              </div>
              <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </CardFooter>
          </Card>

          {/* Enable/Disable */}
          <Card>
            <CardHeader>
              <CardTitle>SSO Status</CardTitle>
              <CardDescription>Control whether SSO is enabled for your organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{config.enabled ? "SSO is enabled" : "SSO is disabled"}</p>
                  <p className="text-sm text-muted-foreground">
                    {config.enabled
                      ? "Members can sign in using their identity provider"
                      : "Enable SSO to allow members to sign in with their IdP"}
                  </p>
                </div>
                <Switch checked={config.enabled} onCheckedChange={handleToggleEnabled} />
              </div>
            </CardContent>
          </Card>

          {/* Service Provider Details */}
          {config.providerType === "saml" && (
            <Card>
              <CardHeader>
                <CardTitle>Service Provider Details</CardTitle>
                <CardDescription>Use these values to configure your identity provider</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">ACS URL (Assertion Consumer Service)</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(`${baseUrl}/api/auth/sso/saml/acs/${organizationId}`)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <code className="text-sm text-muted-foreground break-all">
                    {baseUrl}/api/auth/sso/saml/acs/{organizationId}
                  </code>
                </div>
                <div className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Entity ID / Audience URI</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(`${baseUrl}/api/auth/sso/saml/metadata/${organizationId}`)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <code className="text-sm text-muted-foreground break-all">
                    {baseUrl}/api/auth/sso/saml/metadata/{organizationId}
                  </code>
                </div>
                <div className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">SP Metadata URL</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(`${baseUrl}/api/auth/sso/saml/metadata/${organizationId}`)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <code className="text-sm text-muted-foreground break-all">
                    {baseUrl}/api/auth/sso/saml/metadata/{organizationId}
                  </code>
                </div>
              </CardContent>
            </Card>
          )}

          {config.providerType === "oidc" && (
            <Card>
              <CardHeader>
                <CardTitle>OIDC Callback URL</CardTitle>
                <CardDescription>Add this URL to your OIDC provider&apos;s allowed redirect URIs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">Callback URL</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(`${baseUrl}/api/auth/sso/oidc/callback/${organizationId}`)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <code className="text-sm text-muted-foreground break-all">
                    {baseUrl}/api/auth/sso/oidc/callback/{organizationId}
                  </code>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Test Results */}
          {testResult && (
            <Alert variant={testResult.valid ? "default" : "destructive"}>
              {testResult.valid ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertTitle>{testResult.valid ? "Configuration Valid" : "Configuration Invalid"}</AlertTitle>
              <AlertDescription>
                {testResult.valid ? "Your SSO configuration is valid and ready to use." : testResult.errors.join(", ")}
              </AlertDescription>
            </Alert>
          )}
        </>
      )}

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure Single Sign-On</DialogTitle>
            <DialogDescription>Set up SAML or OIDC authentication for your organization</DialogDescription>
          </DialogHeader>

          <Tabs value={providerType} onValueChange={(v) => setProviderType(v as "saml" | "oidc")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="saml">SAML 2.0</TabsTrigger>
              <TabsTrigger value="oidc">OpenID Connect</TabsTrigger>
            </TabsList>

            <TabsContent value="saml" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="entityId">Entity ID</Label>
                <Input
                  id="entityId"
                  placeholder="https://idp.example.com/sso"
                  value={entityId}
                  onChange={(e) => setEntityId(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">The unique identifier for your identity provider</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ssoUrl">SSO URL</Label>
                <Input
                  id="ssoUrl"
                  placeholder="https://idp.example.com/sso/saml"
                  value={ssoUrl}
                  onChange={(e) => setSsoUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">The URL where authentication requests are sent</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sloUrl">Single Logout URL (Optional)</Label>
                <Input
                  id="sloUrl"
                  placeholder="https://idp.example.com/slo"
                  value={sloUrl}
                  onChange={(e) => setSloUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="certificate">X.509 Certificate</Label>
                <Textarea
                  id="certificate"
                  placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                  value={certificate}
                  onChange={(e) => setCertificate(e.target.value)}
                  rows={5}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">The public certificate used to verify SAML assertions</p>
              </div>
            </TabsContent>

            <TabsContent value="oidc" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="issuer">Issuer URL</Label>
                <Input
                  id="issuer"
                  placeholder="https://idp.example.com"
                  value={issuer}
                  onChange={(e) => setIssuer(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">The base URL of your OIDC provider</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientId">Client ID</Label>
                <Input
                  id="clientId"
                  placeholder="your-client-id"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="clientSecret">Client Secret</Label>
                <Input
                  id="clientSecret"
                  type="password"
                  placeholder="••••••••"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discoveryUrl">Discovery URL (Optional)</Label>
                <Input
                  id="discoveryUrl"
                  placeholder="https://idp.example.com/.well-known/openid-configuration"
                  value={discoveryUrl}
                  onChange={(e) => setDiscoveryUrl(e.target.value)}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-medium">Provisioning Options</h4>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="autoProvision">Auto-Provision Users</Label>
                <p className="text-xs text-muted-foreground">Automatically create accounts for new SSO users</p>
              </div>
              <Switch id="autoProvision" checked={autoProvision} onCheckedChange={setAutoProvision} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultRole">Default Role</Label>
              <Select value={defaultRole} onValueChange={(v) => setDefaultRole(v as "owner" | "member")}>
                <SelectTrigger id="defaultRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="allowedDomains">Allowed Email Domains</Label>
              <Input
                id="allowedDomains"
                placeholder="example.com, company.org"
                value={allowedDomains}
                onChange={(e) => setAllowedDomains(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of allowed domains (leave empty to allow all)
              </p>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Key className="h-4 w-4 mr-2" />}
              Save Configuration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete SSO Configuration</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the SSO configuration? Users will need to sign in with email/password
              after this.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfig}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SSOSettingsPage() {
  return (
    <RequireAuth>
      <SSOContent />
    </RequireAuth>
  );
}
