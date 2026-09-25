"use client";

import { AppShell, PageHeader, type AppShellRole } from "@/components/ui";
import { useI18n, type MessageKey } from "@/lib/i18n";

export function ParticipantSectionView({
  pathname,
  role,
  themeHue,
  titleKey,
}: {
  pathname: string;
  role: AppShellRole;
  themeHue: number;
  titleKey: MessageKey;
}) {
  const { t } = useI18n();
  return (
    <AppShell pathname={pathname} role={role} themeHue={themeHue}>
      <PageHeader title={t(titleKey)} />
    </AppShell>
  );
}
