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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { useToast } from "@/hooks/use-toast";

type Organization = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
};

export function OrganizationSwitcher({
  currentOrganization,
}: {
  currentOrganization: string;
}) {
  const [open, setOpen] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      const { data } = await authClient.organization.list();
      setOrganizations(data || []);

      // Find current active organization
      const current = data?.find((org) => org.slug === currentOrganization);
      setActiveOrg(current || null);
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
      const name = prompt("Enter organization name:");
      if (!name) return;

      const slug = name
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      const { data } = await authClient.organization.create({
        name,
        slug,
      });

      if (data) {
        setOrganizations((prev) => [...prev, data]);
        await authClient.organization.setActive({ organizationId: data.id });
        router.push(`/${data.slug}`);
        setOpen(false);
        toast({
          title: "Success",
          description: "Organization created successfully",
        });
      }
    } catch (error) {
      console.error("Error creating organization:", error);
      toast({
        title: "Error",
        description: "Failed to create organization",
        variant: "destructive",
      });
    }
  };

  const handleSelectOrganization = async (organization: Organization) => {
    try {
      await authClient.organization.setActive({
        organizationId: organization.id,
      });
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
              <AvatarImage
                src={activeOrg?.logo || "/placeholder.svg"}
                alt={activeOrg?.name}
              />
              <AvatarFallback>
                {activeOrg?.name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="font-semibold truncate">
              {activeOrg?.name || "Select Organization"}
            </span>
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
                    <AvatarImage
                      src={organization.logo || "/placeholder.svg"}
                      alt={organization.name}
                    />
                    <AvatarFallback>
                      {organization.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  {organization.name}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      activeOrg?.id === organization.id
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <CommandSeparator />
          <CommandList>
            <CommandGroup>
              <CommandItem onSelect={handleCreateOrganization}>
                <PlusCircle className="mr-2 h-5 w-5" />
                Create Organization
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
