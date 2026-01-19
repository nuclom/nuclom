'use client';

import { authClient } from '@nuclom/lib/auth-client';
import { logger } from '@nuclom/lib/client-logger';
import { cn } from '@nuclom/lib/utils';
import { Check, ChevronsUpDown, PlusCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';

type Organization = {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
};

export function OrganizationSwitcher({ currentOrganization }: { currentOrganization: string }) {
  const [open, setOpen] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeOrg, setActiveOrg] = useState<Organization | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const loadOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);
      const { data } = await authClient.organization.list();
      setOrganizations(data || []);

      // Find current active organization
      const current = data?.find((org) => org.slug === currentOrganization);
      setActiveOrg(current || null);
    } catch (err) {
      logger.error('Failed to load organizations', err);
      setError(true);
      // Only show toast on initial load failure, not on retries
      if (!error) {
        toast({
          title: 'Error',
          description: 'Failed to load organizations. Click to retry.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, toast, error]);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  const handleCreateOrganization = async () => {
    try {
      const name = prompt('Enter organization name:');
      if (!name) return;

      const slug = name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '');

      const { data } = await authClient.organization.create({
        name,
        slug,
      });

      if (data) {
        setOrganizations((prev) => [...prev, data]);
        await authClient.organization.setActive({ organizationId: data.id });
        router.push(`/org/${data.slug}`);
        setOpen(false);
        toast({
          title: 'Success',
          description: 'Organization created successfully',
        });
      }
    } catch (error) {
      logger.error('Failed to create organization', error);
      toast({
        title: 'Error',
        description: 'Failed to create organization',
        variant: 'destructive',
      });
    }
  };

  const handleSelectOrganization = async (organization: Organization) => {
    try {
      await authClient.organization.setActive({
        organizationId: organization.id,
      });
      router.push(`/org/${organization.slug}`);
      setOpen(false);
      setActiveOrg(organization);
    } catch (error) {
      logger.error('Failed to switch organization', error);
      toast({
        title: 'Error',
        description: 'Failed to switch organization',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Button variant="outline" className="h-9 w-full justify-between" disabled>
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-muted animate-pulse" />
          <span className="font-medium">Loading...</span>
        </div>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  if (error && organizations.length === 0) {
    return (
      <Button
        variant="outline"
        className="h-9 w-full justify-between text-destructive hover:text-destructive"
        onClick={loadOrganizations}
      >
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="text-xs">!</span>
          </div>
          <span className="font-medium">Retry</span>
        </div>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="h-9 w-full justify-between">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={activeOrg?.logo || '/placeholder.svg'} alt={activeOrg?.name} />
              <AvatarFallback className="text-xs">{activeOrg?.name?.charAt(0) || '?'}</AvatarFallback>
            </Avatar>
            <span className="font-medium truncate">{activeOrg?.name || 'Select Organization'}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandList>
            <CommandInput placeholder="Search organization..." className="h-10" />
            <CommandEmpty>No organization found.</CommandEmpty>
            <CommandGroup heading="Organizations">
              {organizations.map((organization) => (
                <CommandItem
                  key={organization.id}
                  onSelect={() => handleSelectOrganization(organization)}
                  className="py-2.5 px-3"
                >
                  <Avatar className="mr-2.5 h-6 w-6">
                    <AvatarImage src={organization.logo || '/placeholder.svg'} alt={organization.name} />
                    <AvatarFallback className="text-xs">{organization.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{organization.name}</span>
                  <Check
                    className={cn('ml-auto h-4 w-4', activeOrg?.id === organization.id ? 'opacity-100' : 'opacity-0')}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <CommandSeparator />
          <CommandList>
            <CommandGroup>
              <CommandItem onSelect={handleCreateOrganization} className="py-2.5 px-3">
                <PlusCircle className="mr-2.5 h-5 w-5" />
                <span className="font-medium">Create Organization</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
