"use client";

import Link from "next/link";
import {
  SystemOverviewView,
  type SystemStatusCard,
} from "@/components/SystemOverviewView";
import { useI18n, type MessageKey } from "@/lib/i18n";

export function SystemOverviewClient({
  cards,
  meta,
}: {
  cards: SystemStatusCard[];
  meta: {
    lastSync: string;
    errorCount: number;
    storageLabel: string;
    lastBackup: string;
  };
}) {
  const { t } = useI18n();
  return <SystemOverviewView cards={cards} meta={meta} t={t} />;
}

export function SystemGuidePanel({
  titleKey,
  noteKey,
  actions,
}: {
  titleKey: MessageKey;
  noteKey: MessageKey;
  actions: { href: string; labelKey: MessageKey }[];
}) {
  const { t } = useI18n();
  return (
    <section className="panel stack" style={{ gap: 12, maxWidth: 720 }}>
      <h2 style={{ margin: 0 }}>{t(titleKey)}</h2>
      <p className="muted" style={{ margin: 0 }}>
        {t(noteKey)}
      </p>
      <div className="sys-guide-actions">
        {actions.map((action) => (
          <Link key={action.href} href={action.href} className="btn btn-primary">
            {t(action.labelKey)}
          </Link>
        ))}
      </div>
    </section>
  );
}
