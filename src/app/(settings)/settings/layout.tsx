import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import type React from 'react';
import { UserSettingsSidebar } from '@/components/user-settings-sidebar';
import { UserSettingsTopNav } from '@/components/user-settings-top-nav';
import { auth } from '@/lib/auth';

export default async function UserSettingsLayout({ children }: { children: React.ReactNode }) {
  await connection();

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <UserSettingsTopNav user={session.user} />
      <div className="flex-1 flex min-h-0">
        <div className="hidden md:block">
          <UserSettingsSidebar />
        </div>
        <main className="flex-1 overflow-auto">
          <div className="w-full max-w-screen-xl p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
