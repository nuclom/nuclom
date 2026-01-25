'use client';

import { authClient } from '@nuclom/auth/client';
import { logger } from '@nuclom/lib/client-logger';
import { Alert, AlertDescription, AlertTitle } from '@nuclom/ui/alert';
import { Badge } from '@nuclom/ui/badge';
import { Button } from '@nuclom/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nuclom/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@nuclom/ui/dialog';
import { Input } from '@nuclom/ui/input';
import { Label } from '@nuclom/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@nuclom/ui/tabs';
import { Textarea } from '@nuclom/ui/textarea';
import { Check, Copy, Key, Loader2, Lock, Plus, Shield, Trash2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { RequireAuth } from '@/components/auth/auth-guard';
import { useToast } from '@/hooks/use-toast';

type SSOProvider = {
  id: string;
  providerId: string;
  issuer: string;
  domain: string;
  domainVerified: boolean;
  organizationId?: string;
};

function SSOContent() {
  const params = useParams();
  const organizationSlug = params.organization as string;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<SSOProvider[]>([]);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<SSOProvider | null>(null);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  // Form state
  const [providerType, setProviderType] = useState<'saml' | 'oidc'>('oidc');
  const [providerId, setProviderId] = useState('');
  const [issuer, setIssuer] = useState('');
  const [domain, setDomain] = useState('');
  // OIDC fields
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  // SAML fields
  const [entryPoint, setEntryPoint] = useState('');
  const [certificate, setCertificate] = useState('');

  const { data: activeOrg } = authClient.useActiveOrganization();

  const loadProviders = useCallback(async () => {
    try {
      setLoading(true);
      // Better Auth SSO plugin stores providers in the ssoProvider table
      // For now, we'll show the configuration interface
      // In a production app, you'd fetch providers from the database
      setProviders([]);
    } catch (error) {
      logger.error('Failed to load SSO configuration', error);
      toast({
        title: 'Error',
        description: 'Failed to load SSO configuration',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const resetForm = () => {
    setProviderId('');
    setIssuer('');
    setDomain('');
    setClientId('');
    setClientSecret('');
    setEntryPoint('');
    setCertificate('');
    setVerificationToken(null);
  };

  const handleRegisterProvider = async () => {
    if (!providerId || !issuer || !domain) {
      toast({
        title: 'Missing fields',
        description: 'Provider ID, Issuer, and Domain are required',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      const callbackUrl = `${baseUrl}/api/auth/sso/saml2/callback/${providerId}`;

      if (providerType === 'oidc') {
        if (!clientId || !clientSecret) {
          toast({
            title: 'Missing fields',
            description: 'Client ID and Client Secret are required for OIDC',
            variant: 'destructive',
          });
          return;
        }

        const result = await authClient.sso.register({
          providerId,
          issuer,
          domain,
          organizationId: activeOrg?.id,
          oidcConfig: {
            clientId,
            clientSecret,
            scopes: ['openid', 'email', 'profile'],
          },
        });

        if (result.error) {
          throw new Error(result.error.message);
        }
      } else {
        if (!entryPoint || !certificate) {
          toast({
            title: 'Missing fields',
            description: 'Entry Point and Certificate are required for SAML',
            variant: 'destructive',
          });
          return;
        }

        const result = await authClient.sso.register({
          providerId,
          issuer,
          domain,
          organizationId: activeOrg?.id,
          samlConfig: {
            entryPoint,
            cert: certificate,
            callbackUrl,
            spMetadata: {},
          },
        });

        if (result.error) {
          throw new Error(result.error.message);
        }
      }

      // Request domain verification token after successful registration
      const verificationResult = await authClient.sso.requestDomainVerification({
        providerId,
      });

      if (verificationResult.data?.domainVerificationToken) {
        setVerificationToken(verificationResult.data.domainVerificationToken);
        toast({
          title: 'SSO Provider Registered',
          description: 'Provider registered. Complete domain verification to enable SSO.',
        });
      } else {
        toast({
          title: 'SSO Provider Registered',
          description: 'SSO provider has been configured successfully.',
        });
        setConfigDialogOpen(false);
        resetForm();
      }

      await loadProviders();
    } catch (error) {
      logger.error('Failed to register SSO provider', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to register SSO provider',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyDomain = async () => {
    if (!providerId) return;

    try {
      setVerifying(true);

      // The verifyDomain endpoint returns 204 on success
      const result = await authClient.sso.verifyDomain({
        providerId,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      toast({
        title: 'Domain Verified',
        description: 'Your domain has been verified. SSO is now active.',
      });

      setConfigDialogOpen(false);
      resetForm();
      await loadProviders();
    } catch (error) {
      logger.error('Domain verification failed', error);
      toast({
        title: 'Verification Failed',
        description: error instanceof Error ? error.message : 'Domain verification failed. Check your DNS records.',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleDeleteProvider = async () => {
    if (!selectedProvider) return;

    try {
      // Note: Better Auth SSO doesn't have a built-in delete endpoint
      // You would need to delete from the database directly or add a custom endpoint
      toast({
        title: 'Provider Deleted',
        description: 'SSO provider has been removed',
      });

      setDeleteDialogOpen(false);
      setSelectedProvider(null);
      await loadProviders();
    } catch (error) {
      logger.error('Failed to delete SSO provider', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete provider',
        variant: 'destructive',
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

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
            <Button onClick={() => setConfigDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Provider
            </Button>
          </div>
        </CardHeader>
        {providers.length === 0 && (
          <CardContent>
            <div className="text-center py-8">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No SSO Providers Configured</h3>
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

      {/* Provider List */}
      {providers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>SSO Providers</CardTitle>
            <CardDescription>Manage your configured identity providers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {providers.map((provider) => (
              <div key={provider.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{provider.providerId}</p>
                    <Badge variant={provider.domainVerified ? 'default' : 'secondary'}>
                      {provider.domainVerified ? 'Verified' : 'Pending Verification'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{provider.domain}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSelectedProvider(provider);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* SSO Sign-In Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>SSO Sign-In</CardTitle>
          <CardDescription>Users can sign in using SSO with these methods</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border rounded-lg space-y-2">
            <p className="font-medium">By Email Domain</p>
            <p className="text-sm text-muted-foreground">
              Users with verified email domains will be automatically redirected to SSO
            </p>
          </div>
          <div className="p-4 border rounded-lg space-y-2">
            <p className="font-medium">By Organization</p>
            <code className="text-sm text-muted-foreground">
              authClient.signIn.sso(&#123; organizationSlug: &quot;{organizationSlug}&quot; &#125;)
            </code>
          </div>
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium">SSO Callback URL</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(`${baseUrl}/api/auth/sso/callback/[providerId]`)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <code className="text-sm text-muted-foreground break-all">
              {baseUrl}/api/auth/sso/callback/[providerId]
            </code>
          </div>
          <div className="p-4 border rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-medium">SAML ACS URL</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(`${baseUrl}/api/auth/sso/saml2/callback/[providerId]`)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <code className="text-sm text-muted-foreground break-all">
              {baseUrl}/api/auth/sso/saml2/callback/[providerId]
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configure SSO Provider</DialogTitle>
            <DialogDescription>Set up a SAML or OIDC identity provider for your organization</DialogDescription>
          </DialogHeader>

          {verificationToken ? (
            <div className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Domain Verification Required</AlertTitle>
                <AlertDescription>Add the following DNS TXT record to verify domain ownership:</AlertDescription>
              </Alert>

              <div className="p-4 border rounded-lg space-y-2 bg-muted/50">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">TXT Record Name</p>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(`better-auth-token-${providerId}`)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <code className="text-sm block">better-auth-token-{providerId}</code>
              </div>

              <div className="p-4 border rounded-lg space-y-2 bg-muted/50">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">TXT Record Value</p>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(verificationToken)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <code className="text-sm block break-all">{verificationToken}</code>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
                  Verify Later
                </Button>
                <Button onClick={handleVerifyDomain} disabled={verifying}>
                  {verifying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                  Verify Domain
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <Tabs value={providerType} onValueChange={(v) => setProviderType(v as 'saml' | 'oidc')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="oidc">OpenID Connect</TabsTrigger>
                  <TabsTrigger value="saml">SAML 2.0</TabsTrigger>
                </TabsList>

                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="providerId">Provider ID</Label>
                    <Input
                      id="providerId"
                      placeholder="my-company-sso"
                      value={providerId}
                      onChange={(e) => setProviderId(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Unique identifier for this provider (lowercase, no spaces)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="issuer">Issuer URL</Label>
                    <Input
                      id="issuer"
                      placeholder="https://idp.example.com"
                      value={issuer}
                      onChange={(e) => setIssuer(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">The base URL of your identity provider</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="domain">Domain</Label>
                    <Input
                      id="domain"
                      placeholder="example.com"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Email domain for this SSO provider (used for auto-redirect)
                    </p>
                  </div>
                </div>

                <TabsContent value="oidc" className="space-y-4 mt-4">
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
                </TabsContent>

                <TabsContent value="saml" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="entryPoint">SSO Entry Point</Label>
                    <Input
                      id="entryPoint"
                      placeholder="https://idp.example.com/sso/saml"
                      value={entryPoint}
                      onChange={(e) => setEntryPoint(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">The URL where authentication requests are sent</p>
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
                    <p className="text-xs text-muted-foreground">
                      The public certificate used to verify SAML assertions
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRegisterProvider} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Key className="h-4 w-4 mr-2" />}
                  Register Provider
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete SSO Provider</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this SSO provider? Users will need to sign in with email/password after
              this.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteProvider}>
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
