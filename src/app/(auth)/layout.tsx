import type React from "react";
import { Film } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="mb-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Film className="h-8 w-8 text-[hsl(var(--brand-accent))]" />
          <span className="text-2xl font-bold">Nuclom</span>
        </Link>
      </div>
      {children}
    </div>
  );
}
