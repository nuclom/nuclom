"use client";

import { Check, ChevronsUpDown, PlusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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

const workspaces = [
  {
    slug: "vercel",
    name: "Vercel",
    avatar: "/placeholder.svg?height=24&width=24",
  },
  {
    slug: "acme-inc",
    name: "Acme Inc.",
    avatar: "/placeholder.svg?height=24&width=24",
  },
];

export function WorkspaceSwitcher({
  currentWorkspace,
}: {
  currentWorkspace: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const selectedWorkspace = workspaces.find(
    (ws) => ws.slug === currentWorkspace,
  );

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
                src={selectedWorkspace?.avatar || "/placeholder.svg"}
                alt={selectedWorkspace?.name}
              />
              <AvatarFallback>
                {selectedWorkspace?.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <span className="font-semibold truncate">
              {selectedWorkspace?.name}
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="end">
        <Command>
          <CommandList>
            <CommandInput placeholder="Search workspace..." />
            <CommandEmpty>No workspace found.</CommandEmpty>
            <CommandGroup heading="Workspaces">
              {workspaces.map((workspace) => (
                <CommandItem
                  key={workspace.slug}
                  onSelect={() => {
                    router.push(`/${workspace.slug}`);
                    setOpen(false);
                  }}
                  className="text-sm"
                >
                  <Avatar className="mr-2 h-5 w-5">
                    <AvatarImage
                      src={workspace.avatar || "/placeholder.svg"}
                      alt={workspace.name}
                    />
                    <AvatarFallback>{workspace.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {workspace.name}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      selectedWorkspace?.slug === workspace.slug
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <CommandSeparator />
          <CommandList>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  // Handle create new workspace
                  setOpen(false);
                }}
              >
                <PlusCircle className="mr-2 h-5 w-5" />
                Create Workspace
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
