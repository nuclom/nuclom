"use client";

import { Bell, Film, LogOut, Plus, Settings, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { authClient } from "@/lib/auth-client";
import { CommandBar } from "./command-bar";
import { OrganizationSwitcher } from "./organization-switcher";
import { ThemeToggle } from "./theme-toggle";

interface TopNavProps {
  organization: string;
  organizationId?: string;
}

export function TopNav({ organization, organizationId }: TopNavProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card">
      <div className="flex h-16 items-center px-4 md:px-6 max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href={`/${organization}`} className="flex items-center gap-2.5">
            <Film className="h-7 w-7 text-[hsl(var(--brand-accent))]" />
            <span className="text-lg font-semibold hidden sm:inline-block">Nuclom</span>
          </Link>
          <div className="hidden md:block">
            <OrganizationSwitcher currentOrganization={organization} />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 md:gap-4">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <CommandBar organization={organization} organizationId={organizationId} />
          </div>
          <Button className="hidden sm:inline-flex bg-[hsl(var(--brand-accent))] hover:bg-[hsl(var(--brand-accent))] hover:opacity-90 text-white">
            <Plus className="h-4 w-4 mr-2" />
            New
          </Button>
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Bell className="h-5 w-5" />
            <span className="sr-only">Notifications</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Avatar className="h-9 w-9 cursor-pointer">
                <AvatarImage src={user?.image || "/placeholder.svg?height=36&width=36"} alt="User Avatar" />
                <AvatarFallback>{isLoading ? "..." : getInitials(user?.name)}</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.name || "Loading..."}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email || ""}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/${organization}/settings/profile`}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Users className="mr-2 h-4 w-4" />
                <span>Team</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="px-4 pb-2 md:hidden">
        <OrganizationSwitcher currentOrganization={organization} />
      </div>
    </header>
  );
}
