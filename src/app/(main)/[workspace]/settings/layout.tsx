import type React from "react";
import { SettingsSidebar } from "@/components/settings-sidebar";

export default function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspace: string };
}) {
  return (
    <div className="flex flex-col md:flex-row gap-10">
      <SettingsSidebar workspace={params.workspace} />
      <div className="flex-1">{children}</div>
    </div>
  );
}
