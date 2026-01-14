'use client';

import { Menu, Moon, Sun, X } from 'lucide-react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { DocsSearch } from './docs-search';
import { DocsSidebar } from './docs-sidebar';
import { DocsToc } from './docs-toc';

interface NavSection {
  title: string;
  defaultOpen?: boolean;
  items: {
    name: string;
    url: string;
    icon?: string;
    external?: boolean;
  }[];
}

interface DocsLayoutWrapperProps {
  children: React.ReactNode;
  sections: NavSection[];
  showToc?: boolean;
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1 rounded-lg border p-1">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTheme('light')} aria-label="Light mode">
        <Sun className={`h-4 w-4 ${theme === 'light' ? 'text-primary' : 'text-muted-foreground'}`} />
      </Button>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTheme('dark')} aria-label="Dark mode">
        <Moon className={`h-4 w-4 ${theme === 'dark' ? 'text-primary' : 'text-muted-foreground'}`} />
      </Button>
    </div>
  );
}

export function DocsLayoutWrapper({ children, sections, showToc = true }: DocsLayoutWrapperProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 lg:px-6">
          {/* Mobile Menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" className="mr-2">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 p-0">
              <div className="flex h-14 items-center border-b px-4">
                <Link href="/docs" className="font-semibold" onClick={() => setMobileOpen(false)}>
                  Nuclom Docs
                </Link>
                <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setMobileOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <ScrollArea className="h-[calc(100vh-3.5rem)]">
                <div className="p-4">
                  <DocsSearch />
                  <div className="mt-6">
                    <DocsSidebar sections={sections} />
                  </div>
                </div>
              </ScrollArea>
            </SheetContent>
          </Sheet>

          {/* Logo */}
          <Link href="/docs" className="flex items-center gap-2 font-semibold">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
              N
            </div>
            <span className="hidden sm:inline">Nuclom Docs</span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="ml-6 hidden items-center gap-4 text-sm lg:flex">
            <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
              Home
            </Link>
            <Link
              href="/docs/guides/getting-started"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Guides
            </Link>
            <Link href="/docs/api" className="text-muted-foreground hover:text-foreground transition-colors">
              API
            </Link>
          </nav>

          {/* Right side */}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1">
        <div className="mx-auto flex w-full max-w-[1400px]">
          {/* Left Sidebar */}
          <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 border-r lg:block">
            <ScrollArea className="h-full py-6 px-4">
              <div className="mb-6">
                <DocsSearch />
              </div>
              <DocsSidebar sections={sections} />

              {/* Footer Links */}
              <div className="mt-8 space-y-2 border-t pt-4">
                <Link
                  href="/login"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/signup"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Get started
                </Link>
              </div>
            </ScrollArea>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0">
            <div className="px-4 py-8 lg:px-8 lg:py-10">{children}</div>
          </main>

          {/* Right Sidebar - Table of Contents */}
          {showToc && (
            <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 xl:block">
              <ScrollArea className="h-full py-6 px-4">
                <DocsToc />
              </ScrollArea>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
