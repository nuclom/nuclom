'use client';

import { Upload } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface DashboardHeroProps {
  organization: string;
  userName?: string;
}

export function DashboardHero({ organization, userName }: DashboardHeroProps) {
  const greeting = getGreeting();

  return (
    <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-4 sm:p-6 md:p-8">
      {/* Background pattern - hidden on small screens for better performance */}
      <div className="absolute inset-0 opacity-30 hidden sm:block">
        <svg
          className="absolute right-0 top-0 h-full w-1/2"
          viewBox="0 0 400 400"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="300" cy="100" r="200" stroke="currentColor" strokeWidth="0.5" className="text-primary/20" />
          <circle cx="350" cy="150" r="150" stroke="currentColor" strokeWidth="0.5" className="text-primary/20" />
          <circle cx="280" cy="200" r="100" stroke="currentColor" strokeWidth="0.5" className="text-primary/20" />
        </svg>
      </div>

      <div className="relative z-10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
          {greeting}
          {userName ? `, ${userName.split(' ')[0]}` : ''}!
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 max-w-lg">
          Get started by uploading your first video or recording a quick update.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href={`/org/${organization}/upload`}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Video
            </Link>
          </Button>
          <Button variant="outline" size="lg" className="w-full sm:w-auto" asChild>
            <Link href={`/org/${organization}/record`}>
              <div className="mr-2 h-4 w-4 rounded-full bg-red-500 animate-pulse" />
              Record
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
