"use client";

import { AppShell } from "@/components/ui";
import { ProfileHubHeader } from "@/components/ProfileHubHeader";
import type { ProfileTabId } from "@/lib/admin-profile-hub";

export function ProfileWorkspace({
  tab,
  children,
}: {
  tab: ProfileTabId;
  children: React.ReactNode;
}) {
  return (
    <AppShell pathname={`/admin/profile/${tab}`}>
      <div className="admin-content-narrow">
        <ProfileHubHeader active={tab} />
        {children}
      </div>
    </AppShell>
  );
}
