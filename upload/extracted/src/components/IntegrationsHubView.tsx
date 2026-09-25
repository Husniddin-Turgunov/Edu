"use client";

import Link from "next/link";
import { AppShell, PageHeader } from "@/components/ui";
import { useI18n, type MessageKey } from "@/lib/i18n";

const SECTIONS: {
  href: string;
  titleKey: MessageKey;
  noteKey: MessageKey;
  system: string;
}[] = [
  {
    href: "/integrations/telegram",
    titleKey: "ig_telegram_title",
    noteKey: "ig_telegram_note",
    system: "telegram",
  },
  {
    href: "/integrations/verifix",
    titleKey: "ig_verifix_title",
    noteKey: "ig_verifix_note",
    system: "verifix",
  },
  {
    href: "/integrations/bitrix",
    titleKey: "ig_bitrix_title",
    noteKey: "ig_bitrix_note",
    system: "bitrix",
  },
  {
    href: "/integrations/smtp",
    titleKey: "ig_smtp_title",
    noteKey: "ig_smtp_note",
    system: "smtp",
  },
  {
    href: "/integrations/storage",
    titleKey: "ig_storage_title",
    noteKey: "ig_storage_note",
    system: "storage",
  },
  {
    href: "/integrations/log",
    titleKey: "ig_log_title",
    noteKey: "ig_log_note",
    system: "log",
  },
];

export function IntegrationsHubView({
  statuses,
  embedded = false,
}: {
  statuses: Record<string, boolean>;
  embedded?: boolean;
}) {
  const { t } = useI18n();
  const body = (
    <>
      {!embedded ? (
        <PageHeader
          title={t("nav_integrations")}
          subtitle={t("ig_hub_note")}
        />
      ) : null}
      <section className="stack" style={{ gap: 14, maxWidth: 960 }}>
        <p className="muted" style={{ margin: 0 }}>
          {[
            statuses.drive ? t("hub_drive_on") : t("hub_drive_off"),
            statuses.sheets ? t("hub_sheets_on") : t("hub_sheets_off"),
          ].join(" · ")}
        </p>
        <div
          className="learn-audience-grid"
          style={{ gridTemplateColumns: "1fr" }}
        >
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="learn-audience-btn"
            >
              <strong>
                {t(section.titleKey)}
                {section.system !== "log" ? (
                  <span className="muted">
                    {" "}
                    ·{" "}
                    {statuses[section.system]
                      ? t("ig_status_on")
                      : t("ig_status_off")}
                  </span>
                ) : null}
              </strong>
              <span className="muted">{t(section.noteKey)}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
  if (embedded) return body;
  return <AppShell pathname="/integrations">{body}</AppShell>;
}
