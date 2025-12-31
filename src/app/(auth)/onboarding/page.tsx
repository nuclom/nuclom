"use client";

import { PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export default function OnboardingPage() {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    async function checkOrganizations() {
      try {
        const { data: orgs } = await authClient.organization.list();
        if (orgs && orgs.length > 0) {
          // User already has organizations, redirect to first one
          router.replace(`/${orgs[0].slug}`);
          return;
        }
      } catch (err) {
        console.error("Error checking organizations:", err);
      }
      setLoading(false);
    }
    checkOrganizations();
  }, [router]);

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) return;

    setCreating(true);
    setError(null);

    try {
      const slug = orgName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      const { data, error: createError } = await authClient.organization.create({
        name: orgName,
        slug,
      });

      if (createError) {
        setError(createError.message || "Failed to create organization");
        return;
      }

      if (data) {
        await authClient.organization.setActive({ organizationId: data.id });
        router.replace(`/${data.slug}`);
      }
    } catch (err) {
      console.error("Error creating organization:", err);
      setError("An unexpected error occurred");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to Nuclom</CardTitle>
          <CardDescription>Create your first organization to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateOrganization} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization Name</Label>
              <Input
                id="orgName"
                type="text"
                placeholder="My Team"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
                disabled={creating}
              />
            </div>
            {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}
            <Button type="submit" className="w-full" disabled={creating || !orgName.trim()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              {creating ? "Creating..." : "Create Organization"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
