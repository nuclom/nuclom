"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { authClient } from "@/lib/auth-client";
import { acceptInvitation } from "@/lib/api/organizations";

export default function AcceptInvitationPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInvitation();
  }, [params.id]);

  const loadInvitation = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invitations/${params.id}`);
      const data = await response.json();

      if (response.ok) {
        setInvitation(data);
      } else {
        setError(data.error || "Failed to load invitation");
      }
    } catch (err) {
      setError("Failed to load invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    try {
      setAccepting(true);
      const session = await authClient.getSession();

      if (!session?.data) {
        toast({
          title: "Authentication required",
          description: "Please log in to accept the invitation",
          variant: "destructive",
        });
        router.push("/login");
        return;
      }

      await acceptInvitation(params.id as string, session.data.user.id);

      toast({
        title: "Success",
        description: "You have successfully joined the organization",
      });

      router.push(`/${invitation.organization.slug}`);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to accept invitation",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Loading...</CardTitle>
            <CardDescription>Please wait while we load your invitation</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/")} className="w-full">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Organization Invitation</CardTitle>
          <CardDescription>You've been invited to join {invitation.organization.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>Role: {invitation.role}</p>
            <p>Invited by: {invitation.inviter.name}</p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleAccept} disabled={accepting} className="flex-1">
              {accepting ? "Accepting..." : "Accept Invitation"}
            </Button>
            <Button variant="outline" onClick={() => router.push("/")} className="flex-1">
              Decline
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
