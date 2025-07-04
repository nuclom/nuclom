import type React from "react";
import { SettingsSidebar } from "@/components/settings-sidebar";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;

  return (
    <div className="flex flex-col md:flex-row gap-10">
      <SettingsSidebar workspace={workspace} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
