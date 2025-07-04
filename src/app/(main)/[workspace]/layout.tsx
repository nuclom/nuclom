import type React from "react";
import { TopNav } from "@/components/top-nav";

export default async function MainLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  return (
    <div className="flex flex-col min-h-screen">
      <TopNav workspace={workspace} />
      <main className="flex-1 flex flex-col">
        <div className="flex-1 w-full max-w-screen-2xl mx-auto p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
