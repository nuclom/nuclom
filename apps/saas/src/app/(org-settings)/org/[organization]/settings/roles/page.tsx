'use client';

import { logger } from '@nuclom/lib/client-logger';
import { Badge } from '@nuclom/ui/badge';
import { Button } from '@nuclom/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nuclom/ui/card';
import { Checkbox } from '@nuclom/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@nuclom/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@nuclom/ui/dialog';
import { Input } from '@nuclom/ui/input';
import { Label } from '@nuclom/ui/label';
import { Textarea } from '@nuclom/ui/textarea';
import { Check, ChevronDown, ChevronRight, Edit2, Loader2, Plus, Trash2, UserSquare2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { RequireAuth } from '@/components/auth/auth-guard';
import { useToast } from '@/hooks/use-toast';

type Permission = {
  resource: string;
  action: string;
  conditions?: unknown;
};

type Role = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  isDefault: boolean;
  isSystemRole: boolean;
  permissions: Array<{
    id: string;
    resource: string;
    action: string;
    conditions: unknown;
  }>;
};

const RESOURCES = [
  { name: 'video', label: 'Videos', description: 'Video content management' },
  { name: 'channel', label: 'Channels', description: 'Channel organization' },
  { name: 'collection', label: 'Collections', description: 'Collection management' },
  { name: 'comment', label: 'Comments', description: 'Comments and reactions' },
  { name: 'member', label: 'Members', description: 'Team member management' },
  { name: 'settings', label: 'Settings', description: 'Organization settings' },
  { name: 'billing', label: 'Billing', description: 'Billing and subscription' },
  { name: 'analytics', label: 'Analytics', description: 'Analytics and reports' },
  { name: 'integration', label: 'Integrations', description: 'Third-party integrations' },
  { name: 'audit_log', label: 'Audit Logs', description: 'Security audit logs' },
];

const ACTIONS = [
  { name: 'create', label: 'Create' },
  { name: 'read', label: 'Read' },
  { name: 'update', label: 'Update' },
  { name: 'delete', label: 'Delete' },
  { name: 'share', label: 'Share' },
  { name: 'download', label: 'Download' },
  { name: 'comment', label: 'Comment' },
  { name: 'manage', label: 'Manage' },
  { name: 'invite', label: 'Invite' },
  { name: 'admin', label: 'Admin' },
];

const ROLE_COLORS = [
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#f59e0b' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Gray', value: '#6b7280' },
];

function RolesContent() {
  const params = useParams();
  const organizationId = params.organization as string;
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Role[]>([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedResources, setExpandedResources] = useState<string[]>([]);

  // Form state
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [roleColor, setRoleColor] = useState('#3b82f6');
  const [roleIsDefault, setRoleIsDefault] = useState(false);
  const [rolePermissions, setRolePermissions] = useState<Permission[]>([]);

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/organizations/${organizationId}/roles`);
      const data = await response.json();

      if (data.success) {
        setRoles(data.data);
      }
    } catch (error) {
      logger.error('Failed to load roles', error);
      toast({
        title: 'Error',
        description: 'Failed to load roles',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId, toast]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const openEditDialog = (role?: Role) => {
    if (role) {
      setSelectedRole(role);
      setRoleName(role.name);
      setRoleDescription(role.description || '');
      setRoleColor(role.color || '#3b82f6');
      setRoleIsDefault(role.isDefault);
      setRolePermissions(
        role.permissions.map((p) => ({
          resource: p.resource,
          action: p.action,
          conditions: p.conditions,
        })),
      );
    } else {
      setSelectedRole(null);
      setRoleName('');
      setRoleDescription('');
      setRoleColor('#3b82f6');
      setRoleIsDefault(false);
      setRolePermissions([]);
    }
    setEditDialogOpen(true);
  };

  const handleSaveRole = async () => {
    try {
      setSaving(true);

      const url = selectedRole
        ? `/api/organizations/${organizationId}/roles/${selectedRole.id}`
        : `/api/organizations/${organizationId}/roles`;

      const response = await fetch(url, {
        method: selectedRole ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roleName,
          description: roleDescription,
          color: roleColor,
          isDefault: roleIsDefault,
          permissions: rolePermissions,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: selectedRole ? 'Role updated' : 'Role created',
          description: `${roleName} has been ${selectedRole ? 'updated' : 'created'} successfully.`,
        });
        setEditDialogOpen(false);
        await loadRoles();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      logger.error('Failed to save role', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save role',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;

    try {
      const response = await fetch(`/api/organizations/${organizationId}/roles/${selectedRole.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Role deleted',
          description: `${selectedRole.name} has been deleted.`,
        });
        setDeleteDialogOpen(false);
        await loadRoles();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      logger.error('Failed to delete role', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete role',
        variant: 'destructive',
      });
    }
  };

  const togglePermission = (resource: string, action: string) => {
    const exists = rolePermissions.some((p) => p.resource === resource && p.action === action);

    if (exists) {
      setRolePermissions(rolePermissions.filter((p) => !(p.resource === resource && p.action === action)));
    } else {
      setRolePermissions([...rolePermissions, { resource, action }]);
    }
  };

  const hasPermission = (resource: string, action: string) => {
    return rolePermissions.some((p) => p.resource === resource && p.action === action);
  };

  const toggleResourceExpanded = (resource: string) => {
    if (expandedResources.includes(resource)) {
      setExpandedResources(expandedResources.filter((r) => r !== resource));
    } else {
      setExpandedResources([...expandedResources, resource]);
    }
  };

  const toggleAllActionsForResource = (resource: string) => {
    const resourcePermissions = rolePermissions.filter((p) => p.resource === resource);
    const allChecked = ACTIONS.every((action) => resourcePermissions.some((p) => p.action === action.name));

    if (allChecked) {
      // Remove all
      setRolePermissions(rolePermissions.filter((p) => p.resource !== resource));
    } else {
      // Add all
      const newPermissions = rolePermissions.filter((p) => p.resource !== resource);
      for (const action of ACTIONS) {
        newPermissions.push({ resource, action: action.name });
      }
      setRolePermissions(newPermissions);
    }
  };

  const getResourcePermissionCount = (resource: string) => {
    return rolePermissions.filter((p) => p.resource === resource).length;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Roles & Permissions</CardTitle>
            <CardDescription>Loading roles...</CardDescription>
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
                <UserSquare2 className="h-5 w-5" />
                Roles & Permissions
              </CardTitle>
              <CardDescription>Manage custom roles and granular permissions for your organization</CardDescription>
            </div>
            <Button onClick={() => openEditDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Create Role
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Roles List */}
      <div className="grid gap-4">
        {roles.map((role) => (
          <Card key={role.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: role.color || '#6b7280' }} />
                  <CardTitle className="text-lg">{role.name}</CardTitle>
                  {role.isDefault && <Badge variant="secondary">Default</Badge>}
                  {role.isSystemRole && <Badge variant="outline">System</Badge>}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => openEditDialog(role)} disabled={role.isSystemRole}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedRole(role);
                      setDeleteDialogOpen(true);
                    }}
                    disabled={role.isSystemRole}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {role.description && <CardDescription>{role.description}</CardDescription>}
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {RESOURCES.map((resource) => {
                  const permCount = role.permissions.filter((p) => p.resource === resource.name).length;
                  if (permCount === 0) return null;
                  return (
                    <Badge key={resource.name} variant="outline" className="text-xs">
                      {resource.label}: {permCount} action{permCount !== 1 ? 's' : ''}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedRole ? 'Edit Role' : 'Create Role'}</DialogTitle>
            <DialogDescription>
              {selectedRole
                ? 'Modify the role settings and permissions'
                : 'Create a new custom role with specific permissions'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="roleName">Role Name</Label>
                <Input
                  id="roleName"
                  placeholder="e.g., Content Manager"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roleColor">Color</Label>
                <div className="flex gap-2">
                  {ROLE_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        roleColor === color.value ? 'border-foreground scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setRoleColor(color.value)}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="roleDescription">Description</Label>
              <Textarea
                id="roleDescription"
                placeholder="Describe what this role can do..."
                value={roleDescription}
                onChange={(e) => setRoleDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="roleIsDefault"
                checked={roleIsDefault}
                onCheckedChange={(checked) => setRoleIsDefault(checked === true)}
              />
              <Label htmlFor="roleIsDefault" className="text-sm font-normal">
                Set as default role for new members
              </Label>
            </div>

            {/* Permissions */}
            <div className="space-y-2">
              <Label>Permissions</Label>
              <p className="text-sm text-muted-foreground">
                Select which actions this role can perform on each resource type
              </p>

              <div className="border rounded-lg divide-y">
                {RESOURCES.map((resource) => (
                  <Collapsible
                    key={resource.name}
                    open={expandedResources.includes(resource.name)}
                    onOpenChange={() => toggleResourceExpanded(resource.name)}
                  >
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          {expandedResources.includes(resource.name) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          <div className="text-left">
                            <p className="font-medium">{resource.label}</p>
                            <p className="text-xs text-muted-foreground">{resource.description}</p>
                          </div>
                        </div>
                        <Badge variant="outline">
                          {getResourcePermissionCount(resource.name)} / {ACTIONS.length}
                        </Badge>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 pt-2 bg-muted/30">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-muted-foreground">Actions</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleAllActionsForResource(resource.name);
                            }}
                          >
                            {getResourcePermissionCount(resource.name) === ACTIONS.length
                              ? 'Deselect All'
                              : 'Select All'}
                          </Button>
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          {ACTIONS.map((action) => {
                            const permId = `perm-${resource.name}-${action.name}`;
                            return (
                              <label
                                key={action.name}
                                htmlFor={permId}
                                className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                                  hasPermission(resource.name, action.name)
                                    ? 'bg-primary/10 border-primary'
                                    : 'bg-background hover:bg-muted/50'
                                }`}
                              >
                                <Checkbox
                                  id={permId}
                                  checked={hasPermission(resource.name, action.name)}
                                  onCheckedChange={() => togglePermission(resource.name, action.name)}
                                />
                                <span className="text-xs">{action.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveRole} disabled={saving || !roleName.trim()}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              {selectedRole ? 'Update Role' : 'Create Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedRole?.name}&quot;? Users with this role will lose these
              permissions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteRole}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function RolesSettingsPage() {
  return (
    <RequireAuth>
      <RolesContent />
    </RequireAuth>
  );
}
