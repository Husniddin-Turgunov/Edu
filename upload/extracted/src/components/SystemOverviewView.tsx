import Link from "next/link";
import type { MessageKey } from "@/lib/i18n";

export type SystemStatusTone = "ok" | "warn" | "error" | "unset";

export type SystemStatusCard = {
  id: string;
  titleKey: MessageKey;
  tone: SystemStatusTone;
  detail: string;
  href: string;
};

const TONE_CLASS: Record<SystemStatusTone, string> = {
  ok: "sys-status-ok",
  warn: "sys-status-warn",
  error: "sys-status-error",
  unset: "sys-status-unset",
};

export function SystemOverviewView({
  cards,
  meta,
  t,
}: {
  cards: SystemStatusCard[];
  meta: {
    lastSync: string;
    errorCount: number;
    storageLabel: string;
    lastBackup: string;
  };
  t: (key: MessageKey) => string;
}) {
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="sys-meta-row">
        <div className="sys-meta-chip">
          <span className="muted">{t("sys_meta_sync")}</span>
          <strong>{meta.lastSync}</strong>
        </div>
        <div className="sys-meta-chip">
          <span className="muted">{t("sys_meta_errors")}</span>
          <strong>{meta.errorCount}</strong>
        </div>
        <div className="sys-meta-chip">
          <span className="muted">{t("sys_meta_storage")}</span>
          <strong>{meta.storageLabel}</strong>
        </div>
        <div className="sys-meta-chip">
          <span className="muted">{t("sys_meta_backup")}</span>
          <strong>{meta.lastBackup}</strong>
        </div>
      </div>

      <div className="sys-status-grid">
        {cards.map((card) => (
          <Link
            key={card.id}
            href={card.href}
            className={`sys-status-card ${TONE_CLASS[card.tone]}`}
          >
            <span className="sys-status-dot" aria-hidden />
            <strong>{t(card.titleKey)}</strong>
            <span className="muted">{card.detail}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
