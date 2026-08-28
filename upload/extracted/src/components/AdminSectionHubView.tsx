"use client";

import Link from "next/link";
import { AppShell, PageHeader } from "@/components/ui";
import { useI18n, type MessageKey } from "@/lib/i18n";

export type AdminHubLink = {
  href: string;
  titleKey: MessageKey;
  noteKey?: MessageKey;
  /** Plain note when no i18n key (e.g. dynamic status). */
  note?: string;
};

export function AdminSectionHubView({
  pathname,
  titleKey,
  noteKey,
  links,
  statusKeys,
}: {
  pathname: string;
  titleKey: MessageKey;
  noteKey: MessageKey;
  links: AdminHubLink[];
  /** Optional status lines (e.g. Drive / Sheets connected). */
  statusKeys?: MessageKey[];
}) {
  const { t } = useI18n();

  return (
    <AppShell pathname={pathname}>
      <PageHeader title={t(titleKey)} subtitle={t(noteKey)} />
      <section className="stack" style={{ gap: 18, maxWidth: 960 }}>
        {statusKeys && statusKeys.length > 0 ? (
          <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
            {statusKeys.map((key) => t(key)).join(" · ")}
          </p>
        ) : null}
        <div
          className="learn-audience-grid"
          style={{ gridTemplateColumns: "1fr" }}
        >
          {links.map((link) => (
            <Link
              key={`${link.href}:${link.titleKey}`}
              href={link.href}
              className="learn-audience-btn"
            >
              <strong>{t(link.titleKey)}</strong>
              {link.noteKey ? (
                <span className="muted">{t(link.noteKey)}</span>
              ) : null}
              {link.note ? <span className="muted">{link.note}</span> : null}
            </Link>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
