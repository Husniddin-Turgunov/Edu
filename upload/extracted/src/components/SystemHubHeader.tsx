"use client";

import Link from "next/link";
import { SYSTEM_TAB_DEFS, type SystemTabId } from "@/lib/admin-system-hub";
import { useI18n } from "@/lib/i18n";

export function SystemHubHeader({ active }: { active: SystemTabId }) {
  const { t } = useI18n();
  return (
    <div className="hiring-hub-header system-hub-header">
      <p className="muted hiring-hub-subtitle">{t("sys_hub_subtitle")}</p>
      <nav className="admin-hub-tabs hiring-hub-tabs" aria-label={t("nav_admin_system")}>
        {SYSTEM_TAB_DEFS.map((tab) => (
          <Link
            key={tab.id}
            href={tab.href}
            className={tab.id === active ? "admin-hub-tab active" : "admin-hub-tab"}
          >
            <span>{t(tab.labelKey)}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
