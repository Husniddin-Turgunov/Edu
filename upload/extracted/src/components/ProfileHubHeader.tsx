"use client";

import Link from "next/link";
import { PROFILE_TAB_DEFS, type ProfileTabId } from "@/lib/admin-profile-hub";
import { useI18n } from "@/lib/i18n";

export function ProfileHubHeader({ active }: { active: ProfileTabId }) {
  const { t } = useI18n();
  return (
    <div className="hiring-hub-header profile-hub-header">
      <nav
        className="admin-hub-tabs hiring-hub-tabs"
        aria-label={t("nav_admin_profile")}
      >
        {PROFILE_TAB_DEFS.map((tab) => (
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
