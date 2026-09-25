"use client";

import { AppShell } from "@/components/ui";
import { SystemHubHeader } from "@/components/SystemHubHeader";
import type { SystemTabId } from "@/lib/admin-system-hub";

export function SystemWorkspace({
  tab,
  children,
}: {
  tab: SystemTabId;
  children: React.ReactNode;
}) {
  return (
    <AppShell pathname={`/admin/system/${tab}`}>
      <div className="admin-content-narrow">
        <SystemHubHeader active={tab} />
        {children}
      </div>
    </AppShell>
  );
}
