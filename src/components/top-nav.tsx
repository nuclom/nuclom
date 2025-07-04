"use client";

import { Bell, Film, Plus, Settings, Users } from "lucide-react";
import Link from "next/link";
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
import { CommandBar } from "./command-bar";
import { ThemeToggle } from "./theme-toggle";
import { WorkspaceSwitcher } from "./workspace-switcher";

export function TopNav({ workspace }: { workspace: string }) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card">
      <div className="flex h-16 items-center px-4 md:px-6 max-w-screen-2xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href={`/${workspace}`} className="flex items-center gap-2.5">
            <Film className="h-7 w-7 text-[hsl(var(--brand-accent))]" />
            <span className="text-lg font-semibold hidden sm:inline-block">
              Nuclom
            </span>
          </Link>
          <div className="hidden md:block">
            <WorkspaceSwitcher currentWorkspace={workspace} />
          </div>
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 md:gap-4">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <CommandBar workspace={workspace} />
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
                <AvatarImage
                  src="/placeholder.svg?height=36&width=36"
                  alt="User Avatar"
                />
                <AvatarFallback>U</AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={`/${workspace}/settings/profile`}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Users className="mr-2 h-4 w-4" />
                <span>Team</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="px-4 pb-2 md:hidden">
        <WorkspaceSwitcher currentWorkspace={workspace} />
      </div>
    </header>
  );
}
