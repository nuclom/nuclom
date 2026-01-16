'use client';

import { Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
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
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { authClient } from '@/lib/auth-client';

type Organization = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
};

function OrganizationSettingsContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
  });

  const loadOrganization = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await authClient.organization.list();
      const currentOrg = data?.find((org) => org.slug === params.organization);

      if (currentOrg) {
        setOrganization(currentOrg);
        setFormData({
          name: currentOrg.name,
          slug: currentOrg.slug,
        });
      }
    } catch (error) {
      console.error('Error loading organization:', error);
      toast({
        title: 'Error',
        description: 'Failed to load organization details',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [params.organization, toast]);

  useEffect(() => {
    loadOrganization();
  }, [loadOrganization]);

  const handleSave = async () => {
    if (!organization) return;

    try {
      setSaving(true);
      await authClient.organization.update({
        data: {
          name: formData.name,
          slug: formData.slug,
        },
      });

      toast({
        title: 'Success',
        description: 'Organization updated successfully',
      });

      // If slug changed, redirect to new URL
      if (formData.slug !== organization.slug) {
        router.push(`/org/${formData.slug}/settings/organization`);
      }
    } catch (error) {
      console.error('Error updating organization:', error);
      toast({
        title: 'Error',
        description: 'Failed to update organization',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!organization) return;

    try {
      setDeleting(true);
      await authClient.organization.delete({
        organizationId: organization.id,
      });

      toast({
        title: 'Success',
        description: 'Organization deleted successfully',
      });

      // Redirect to home or organization list
      router.push('/');
    } catch (error) {
      console.error('Error deleting organization:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete organization',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>Manage your organization settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Organization Name</Label>
            <div className="h-10 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="space-y-2">
            <Label>Organization Slug</Label>
            <div className="h-10 bg-gray-200 rounded animate-pulse" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!organization) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Organization Not Found</CardTitle>
          <CardDescription>
            The organization you're looking for doesn't exist or you don't have access to it.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization</CardTitle>
        <CardDescription>Manage your organization settings.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="organization-name">Organization Name</Label>
          <Input
            id="organization-name"
            value={formData.name}
            onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Enter organization name"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="organization-slug">Organization Slug</Label>
          <Input
            id="organization-slug"
            value={formData.slug}
            onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
            placeholder="organization-slug"
          />
          <p className="text-sm text-muted-foreground">This will be used in your organization URL: /{formData.slug}</p>
        </div>
      </CardContent>
      <CardFooter className="bg-muted/50 border-t px-6 py-4 flex justify-between">
        <Button onClick={handleSave} disabled={saving || !formData.name.trim() || !formData.slug.trim()}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={deleting}>
              Delete Organization
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the organization "{organization.name}" and
                all its data including videos, channels, and member access.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? 'Deleting...' : 'Delete Organization'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}

function OrganizationSettingsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization</CardTitle>
        <CardDescription>Manage your organization settings.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function OrganizationSettingsPage() {
  return (
    <Suspense fallback={<OrganizationSettingsSkeleton />}>
      <OrganizationSettingsContent />
    </Suspense>
  );
}
