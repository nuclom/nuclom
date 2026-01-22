'use client';

import { authClient } from '@nuclom/auth/client';
import { logger } from '@nuclom/lib/client-logger';
import type { Member, Organization, User } from '@nuclom/lib/db/schema';
import { CheckCircle2, Clock, Loader2, Mail, MailX, MoreHorizontal, Plus, Shield, UserMinus } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

type MemberWithUser = Member & {
  user: User;
};

type Invitation = {
  id: string;
  email: string;
  role: string | null;
  status: string;
  expiresAt: string;
  createdAt: string;
  inviter: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
};

function MembersSettingsContent() {
  const params = useParams();
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteData, setInviteData] = useState<{
    email: string;
    role: 'member' | 'owner';
  }>({
    email: '',
    role: 'member',
  });
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'remove_member' | 'cancel_invitation' | null;
    memberId?: string;
    memberName?: string;
    invitationId?: string;
    email?: string;
  }>({ open: false, type: null });

  const loadOrganizationAndMembers = useCallback(async () => {
    try {
      setLoading(true);

      // Get organization
      const { data: orgs } = await authClient.organization.list();
      const currentOrg = orgs?.find((org) => org.slug === params.organization);

      if (!currentOrg) {
        toast({
          title: 'Error',
          description: 'Organization not found',
          variant: 'destructive',
        });
        return;
      }

      setOrganization({
        ...currentOrg,
        metadata: currentOrg.metadata || null,
        slug: currentOrg.slug,
        logo: currentOrg.logo || null,
      });

      // Fetch members and invitations in parallel
      const [membersResponse, invitationsResponse] = await Promise.all([
        fetch(`/api/organizations/${currentOrg.id}/members`),
        fetch(`/api/organizations/${currentOrg.id}/invitations`),
      ]);

      if (membersResponse.ok) {
        const data = await membersResponse.json();
        setMembers(data || []);
      }

      if (invitationsResponse.ok) {
        const data = await invitationsResponse.json();
        setInvitations(data || []);
      }
    } catch (error) {
      logger.error('Failed to load organization members', error);
      toast({
        title: 'Error',
        description: 'Failed to load organization members',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [params.organization, toast]);

  useEffect(() => {
    loadOrganizationAndMembers();
  }, [loadOrganizationAndMembers]);

  const handleInviteMember = async () => {
    if (!organization || !inviteData.email.trim()) return;

    try {
      setInviting(true);
      await authClient.organization.inviteMember({
        email: inviteData.email,
        role: inviteData.role,
      });

      // Show success state in dialog
      setInviteSuccess(inviteData.email);

      toast({
        title: 'Invitation sent',
        description: `${inviteData.email} will receive an email with instructions to join.`,
      });

      // Close dialog after showing success briefly
      setTimeout(() => {
        setInviteDialogOpen(false);
        setInviteData({ email: '', role: 'member' });
        setInviteSuccess(null);
      }, 1500);

      // Reload members
      await loadOrganizationAndMembers();
    } catch (error) {
      logger.error('Failed to send invitation', error);
      toast({
        title: 'Error',
        description: 'Failed to send invitation. Please check the email and try again.',
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: 'member' | 'owner') => {
    if (!organization) return;

    try {
      await authClient.organization.updateMemberRole({
        memberId: memberId,
        role: newRole,
      });

      toast({
        title: 'Success',
        description: 'Member role updated successfully',
      });

      // Reload members
      await loadOrganizationAndMembers();
    } catch (error) {
      logger.error('Failed to update member role', error);
      toast({
        title: 'Error',
        description: 'Failed to update member role',
        variant: 'destructive',
      });
    }
  };

  const openRemoveMemberDialog = (memberId: string, memberName: string) => {
    setConfirmDialog({
      open: true,
      type: 'remove_member',
      memberId,
      memberName,
    });
  };

  const handleRemoveMember = async () => {
    if (!organization || !confirmDialog.memberId) return;

    try {
      await authClient.organization.removeMember({
        memberIdOrEmail: confirmDialog.memberId,
      });

      toast({
        title: 'Member removed',
        description: `${confirmDialog.memberName} has been removed from the organization`,
      });

      // Reload members
      await loadOrganizationAndMembers();
    } catch (error) {
      logger.error('Failed to remove member', error);
      toast({
        title: 'Error',
        description: 'Failed to remove member',
        variant: 'destructive',
      });
    }
  };

  const openCancelInvitationDialog = (invitationId: string, email: string) => {
    setConfirmDialog({
      open: true,
      type: 'cancel_invitation',
      invitationId,
      email,
    });
  };

  const handleCancelInvitation = async () => {
    if (!organization || !confirmDialog.invitationId) return;

    try {
      const response = await fetch(
        `/api/organizations/${organization.id}/invitations?invitationId=${confirmDialog.invitationId}`,
        {
          method: 'DELETE',
        },
      );

      if (!response.ok) {
        throw new Error('Failed to cancel invitation');
      }

      toast({
        title: 'Invitation cancelled',
        description: `The invitation for ${confirmDialog.email} has been cancelled`,
      });

      // Reload data
      await loadOrganizationAndMembers();
    } catch (error) {
      logger.error('Failed to cancel invitation', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel invitation',
        variant: 'destructive',
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case 'owner':
        return 'default';
      case 'member':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>Loading organization members...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <div className="h-8 w-8 bg-gray-200 rounded-full animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Members</CardTitle>
            <CardDescription>Manage who has access to this organization.</CardDescription>
          </div>
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              {inviteSuccess ? (
                <div className="flex flex-col items-center py-6 text-center">
                  <div className="rounded-full bg-green-100 p-3 mb-4">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <DialogTitle className="mb-2">Invitation Sent</DialogTitle>
                  <DialogDescription>
                    We've sent an invitation email to{' '}
                    <span className="font-medium text-foreground">{inviteSuccess}</span>
                  </DialogDescription>
                </div>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Invite Member</DialogTitle>
                    <DialogDescription>Send an invitation to join {organization?.name}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="colleague@company.com"
                          value={inviteData.email}
                          className="pl-9"
                          onChange={(e) =>
                            setInviteData((prev) => ({
                              ...prev,
                              email: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select
                        value={inviteData.role}
                        onValueChange={(value: 'member' | 'owner') =>
                          setInviteData((prev) => ({ ...prev, role: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">
                            <div className="flex flex-col items-start">
                              <span>Member</span>
                              <span className="text-xs text-muted-foreground">Can view and comment on videos</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="owner">
                            <div className="flex flex-col items-start">
                              <span>Owner</span>
                              <span className="text-xs text-muted-foreground">Full access including settings</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setInviteDialogOpen(false)} disabled={inviting}>
                      Cancel
                    </Button>
                    <Button onClick={handleInviteMember} disabled={inviting || !inviteData.email.trim()}>
                      {inviting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        'Send Invitation'
                      )}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="pl-6">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.user.image || '/placeholder.svg'} />
                        <AvatarFallback>{member.user.name.slice(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{member.user.name}</div>
                        <div className="text-sm text-muted-foreground">{member.user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(member.role)}>{member.role}</Badge>
                  </TableCell>
                  <TableCell className="text-right pr-4">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {member.role !== 'owner' && (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleUpdateRole(member.id, member.role === 'member' ? 'owner' : 'member')}
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              {member.role === 'member' ? 'Make Owner' : 'Make Member'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openRemoveMemberDialog(member.id, member.user.name)}
                              className="text-destructive"
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              Remove Member
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Invitations
            </CardTitle>
            <CardDescription>
              {invitations.length} pending invitation{invitations.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell className="pl-6">
                      <div className="font-medium">{invitation.email}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(invitation.role || 'member')}>
                        {invitation.role || 'member'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={invitation.inviter.image || '/placeholder.svg'} />
                          <AvatarFallback>{invitation.inviter.name.slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-muted-foreground">{invitation.inviter.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={isExpired(invitation.expiresAt) ? 'text-destructive' : 'text-muted-foreground'}>
                        {isExpired(invitation.expiresAt) ? 'Expired' : formatDate(invitation.expiresAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openCancelInvitationDialog(invitation.id, invitation.email)}
                        className="text-destructive hover:text-destructive"
                      >
                        <MailX className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={confirmDialog.open && confirmDialog.type === 'remove_member'}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title="Remove member"
        description={
          <>
            Are you sure you want to remove <strong>{confirmDialog.memberName}</strong> from this organization? They
            will lose access to all organization resources.
          </>
        }
        actionLabel="Remove member"
        onConfirm={handleRemoveMember}
        variant="destructive"
      />

      <ConfirmDialog
        open={confirmDialog.open && confirmDialog.type === 'cancel_invitation'}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title="Cancel invitation"
        description={
          <>
            Are you sure you want to cancel the invitation for <strong>{confirmDialog.email}</strong>? They will no
            longer be able to join using the invitation link.
          </>
        }
        actionLabel="Cancel invitation"
        onConfirm={handleCancelInvitation}
        variant="warning"
      />
    </div>
  );
}

function MembersSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>Loading organization members...</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function MembersSettingsPage() {
  return (
    <Suspense fallback={<MembersSkeleton />}>
      <MembersSettingsContent />
    </Suspense>
  );
}
