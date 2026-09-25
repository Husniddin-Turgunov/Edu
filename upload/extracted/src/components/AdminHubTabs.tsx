"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import {
  ADMIN_HUBS,
  isAdminHubTabActive,
  resolveAdminHub,
  type AdminHub,
  type AdminHubId,
} from "@/lib/admin-navigation";

const HUB_IDS = new Set<AdminHubId>([
  "desk",
  "hiring",
  "staff",
  "development",
  "methodology",
  "reports",
  "system",
]);

export function AdminHubTabs({ pathname }: { pathname?: string }) {
  const { t } = useI18n();
  const pathFromRouter = usePathname() ?? "";
  const searchParams = useSearchParams();
  const path = pathname ?? pathFromRouter;
  const search = searchParams?.toString() ?? "";
  const hubParam = searchParams?.get("hub");
  const forced =
    hubParam && HUB_IDS.has(hubParam as AdminHubId)
      ? ADMIN_HUBS.find((item) => item.id === hubParam) ?? null
      : null;
  const hub = forced ?? resolveAdminHub(path);
  if (!hub || hub.tabs.length === 0) return null;

  return (
    <nav className="admin-hub-tabs" aria-label={t(hub.navKey)}>
      {hub.tabs.map((tab) => {
        const active = isAdminHubTabActive(path, tab, search);
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={active ? "admin-hub-tab active" : "admin-hub-tab"}
          >
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}

export function adminHubTitleKey(hub: AdminHub | null) {
  return hub?.navKey ?? "nav_admin_desk";
}
