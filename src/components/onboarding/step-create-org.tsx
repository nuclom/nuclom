"use client";

import { ArrowRight, Building2, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface StepCreateOrgProps {
  onNext: (data: { name: string; slug: string }) => void;
  onBack: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function StepCreateOrg({ onNext, onBack, isLoading, error }: StepCreateOrgProps) {
  const [orgName, setOrgName] = useState("");

  const slug = orgName
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orgName.trim() && slug) {
      onNext({ name: orgName.trim(), slug });
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-4">
          <Building2 className="w-7 h-7 text-white" />
        </div>
        <h2 className="text-2xl font-bold">Create your workspace</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Your workspace is where your team collaborates on videos. You can invite teammates after setup.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
        <div className="space-y-2">
          <Label htmlFor="orgName">Workspace Name</Label>
          <Input
            id="orgName"
            type="text"
            placeholder="Acme Inc."
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            disabled={isLoading}
            className="h-12 text-base"
            autoFocus
          />
          {slug && (
            <p className="text-sm text-muted-foreground">
              Your workspace URL: <span className="font-mono text-foreground">nuclom.com/{slug}</span>
            </p>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button type="button" variant="ghost" onClick={onBack} disabled={isLoading}>
            Back
          </Button>
          <Button type="submit" disabled={!orgName.trim() || isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Create Workspace
                <ArrowRight className="ml-2 w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
