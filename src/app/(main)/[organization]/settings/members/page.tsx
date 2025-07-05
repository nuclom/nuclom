"use client";

import { MoreHorizontal, Plus, Mail, UserMinus, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";

import type { Member, User, Organization } from "@/lib/db/schema";

type MemberWithUser = Member & {
  user: User;
};

export default function MembersSettingsPage() {
  const params = useParams();
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteData, setInviteData] = useState<{
    email: string;
    role: "member" | "owner";
  }>({
    email: "",
    role: "member",
  });
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadOrganizationAndMembers();
  }, [params.organization]);

  const loadOrganizationAndMembers = async () => {
    try {
      setLoading(true);

      // Get organization
      const { data: orgs } = await authClient.organization.list();
      const currentOrg = orgs?.find((org) => org.slug === params.organization);

      if (!currentOrg) {
        toast({
          title: "Error",
          description: "Organization not found",
          variant: "destructive",
        });
        return;
      }

      setOrganization({
        ...currentOrg,
        metadata: currentOrg.metadata || null,
        slug: currentOrg.slug || null,
        logo: currentOrg.logo || null,
      });

      // For now, we'll need to fetch members via a custom API since BetterAuth
      // doesn't expose a direct client method for listing members
      const response = await fetch(
        `/api/organizations/${currentOrg.id}/members`
      );
      if (response.ok) {
        const data = await response.json();
        setMembers(data || []);
      }
    } catch (error) {
      console.error("Error loading organization and members:", error);
      toast({
        title: "Error",
        description: "Failed to load organization members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!organization || !inviteData.email.trim()) return;

    try {
      setInviting(true);
      await authClient.organization.inviteMember({
        email: inviteData.email,
        role: inviteData.role,
      });

      toast({
        title: "Success",
        description: `Invitation sent to ${inviteData.email}`,
      });

      setInviteDialogOpen(false);
      setInviteData({ email: "", role: "member" });

      // Reload members
      await loadOrganizationAndMembers();
    } catch (error) {
      console.error("Error inviting member:", error);
      toast({
        title: "Error",
        description: "Failed to send invitation",
        variant: "destructive",
      });
    } finally {
      setInviting(false);
    }
  };

  const handleUpdateRole = async (
    memberId: string,
    newRole: "member" | "owner"
  ) => {
    if (!organization) return;

    try {
      await authClient.organization.updateMemberRole({
        memberId: memberId,
        role: newRole,
      });

      toast({
        title: "Success",
        description: "Member role updated successfully",
      });

      // Reload members
      await loadOrganizationAndMembers();
    } catch (error) {
      console.error("Error updating member role:", error);
      toast({
        title: "Error",
        description: "Failed to update member role",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!organization) return;

    const confirmed = confirm(
      `Are you sure you want to remove ${memberName} from the organization?`
    );
    if (!confirmed) return;

    try {
      await authClient.organization.removeMember({
        memberIdOrEmail: memberId,
      });

      toast({
        title: "Success",
        description: `${memberName} has been removed from the organization`,
      });

      // Reload members
      await loadOrganizationAndMembers();
    } catch (error) {
      console.error("Error removing member:", error);
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
      case "owner":
        return "default";
      case "member":
        return "outline";
      default:
        return "outline";
    }
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            Manage who has access to this organization.
          </CardDescription>
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Member</DialogTitle>
              <DialogDescription>
                Send an invitation to join {organization?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address"
                  value={inviteData.email}
                  onChange={(e) =>
                    setInviteData((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={inviteData.role}
                  onValueChange={(value: "member" | "owner") =>
                    setInviteData((prev) => ({ ...prev, role: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleInviteMember}
                disabled={inviting || !inviteData.email.trim()}
              >
                {inviting ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
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
                      <AvatarImage
                        src={member.user.image || "/placeholder.svg"}
                      />
                      <AvatarFallback>
                        {member.user.name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{member.user.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {member.user.email}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getRoleBadgeVariant(member.role)}>
                    {member.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-right pr-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {member.role !== "owner" && (
                        <>
                          <DropdownMenuItem
                            onClick={() =>
                              handleUpdateRole(
                                member.id,
                                member.role === "member" ? "owner" : "member"
                              )
                            }
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            {member.role === "member"
                              ? "Make Owner"
                              : "Make Member"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              handleRemoveMember(member.id, member.user.name)
                            }
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
  );
}
