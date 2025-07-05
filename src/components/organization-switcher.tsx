"use client";

import { Check, ChevronsUpDown, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";

type Organization = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
};

export function OrganizationSwitcher({ currentWorkspace }: { currentWorkspace: string }) {
  const [open, setOpen] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createData, setCreateData] = useState({ name: "", slug: "" });
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/organizations");
      const data = await response.json();

      if (response.ok) {
        setOrganizations(data || []);
        const current = data?.find((org: Organization) => org.slug === currentWorkspace);
        setActiveOrg(current || null);
      } else {
        throw new Error(data.error || "Failed to load organizations");
      }
    } catch (error) {
      console.error("Error loading organizations:", error);
      toast({
        title: "Error",
        description: "Failed to load organizations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrganization = async () => {
    try {
      setCreating(true);

      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createData),
      });

      const data = await response.json();

      if (response.ok) {
        setOrganizations((prev) => [...prev, data]);
        router.push(`/${data.slug}`);
        setOpen(false);
        setCreateDialogOpen(false);
        setCreateData({ name: "", slug: "" });
        toast({
          title: "Success",
          description: "Organization created successfully",
        });
      } else {
        throw new Error(data.error || "Failed to create organization");
      }
    } catch (error) {
      console.error("Error creating organization:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create organization",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  };

  const handleSelectOrganization = async (organization: Organization) => {
    try {
      router.push(`/${organization.slug}`);
      setOpen(false);
      setActiveOrg(organization);
    } catch (error) {
      console.error("Error switching organization:", error);
      toast({
        title: "Error",
        description: "Failed to switch organization",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Button
        variant="outline"
        className="w-full justify-between bg-gray-800 border-gray-700 hover:bg-gray-700"
        disabled
      >
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-gray-600 animate-pulse" />
          <span className="font-semibold">Loading...</span>
        </div>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-gray-800 border-gray-700 hover:bg-gray-700"
          >
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={activeOrg?.logo || "/placeholder.svg"} alt={activeOrg?.name} />
                <AvatarFallback>{activeOrg?.name?.charAt(0) || "?"}</AvatarFallback>
              </Avatar>
              <span className="font-semibold truncate">{activeOrg?.name || "Select Organization"}</span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="end">
          <Command>
            <CommandList>
              <CommandInput placeholder="Search organization..." />
              <CommandEmpty>No organization found.</CommandEmpty>
              <CommandGroup heading="Organizations">
                {organizations.map((organization) => (
                  <CommandItem
                    key={organization.id}
                    onSelect={() => handleSelectOrganization(organization)}
                    className="text-sm"
                  >
                    <Avatar className="mr-2 h-5 w-5">
                      <AvatarImage src={organization.logo || "/placeholder.svg"} alt={organization.name} />
                      <AvatarFallback>{organization.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {organization.name}
                    <Check
                      className={cn("ml-auto h-4 w-4", activeOrg?.id === organization.id ? "opacity-100" : "opacity-0")}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <CommandSeparator />
            <CommandList>
              <CommandGroup>
                <CommandItem onSelect={() => setCreateDialogOpen(true)}>
                  <PlusCircle className="mr-2 h-5 w-5" />
                  Create Organization
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>Create a new organization to collaborate with your team.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                placeholder="My Organization"
                value={createData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setCreateData((prev) => ({
                    ...prev,
                    name,
                    slug: generateSlug(name),
                  }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                placeholder="my-organization"
                value={createData.slug}
                onChange={(e) => setCreateData((prev) => ({ ...prev, slug: e.target.value }))}
              />
              <p className="text-sm text-muted-foreground">
                This will be used in your organization URL: /{createData.slug}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreateOrganization}
              disabled={creating || !createData.name.trim() || !createData.slug.trim()}
            >
              {creating ? "Creating..." : "Create Organization"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
