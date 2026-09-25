import type { MessageKey } from "@/lib/i18n";

export const SYSTEM_TABS = [
  "overview",
  "company",
  "users",
  "roles",
  "integrations",
  "notifications",
  "processes",
  "design",
  "security",
  "storage",
  "sync",
  "audit",
  "health",
  "backups",
] as const;

export type SystemTabId = (typeof SYSTEM_TABS)[number];

export type SystemTabDef = {
  id: SystemTabId;
  href: string;
  labelKey: MessageKey;
  /** Existing screen to embed / link when no dedicated panel */
  legacyHref?: string;
};

export const SYSTEM_TAB_DEFS: SystemTabDef[] = [
  {
    id: "overview",
    href: "/admin/system/overview",
    labelKey: "sys_tab_overview",
  },
  {
    id: "company",
    href: "/admin/system/company",
    labelKey: "sys_tab_company",
    legacyHref: "/settings/company",
  },
  {
    id: "users",
    href: "/admin/system/users",
    labelKey: "sys_tab_users",
    legacyHref: "/access",
  },
  {
    id: "roles",
    href: "/admin/system/roles",
    labelKey: "sys_tab_roles",
    legacyHref: "/settings/permissions",
  },
  {
    id: "integrations",
    href: "/admin/system/integrations",
    labelKey: "sys_tab_integrations",
    legacyHref: "/integrations",
  },
  {
    id: "notifications",
    href: "/admin/system/notifications",
    labelKey: "sys_tab_notifications",
    legacyHref: "/settings/notifications",
  },
  {
    id: "processes",
    href: "/admin/system/processes",
    labelKey: "sys_tab_processes",
    legacyHref: "/settings/tests",
  },
  {
    id: "design",
    href: "/admin/system/design",
    labelKey: "sys_tab_design",
    legacyHref: "/design",
  },
  {
    id: "security",
    href: "/admin/system/security",
    labelKey: "sys_tab_security",
    legacyHref: "/settings/security",
  },
  {
    id: "storage",
    href: "/admin/system/storage",
    labelKey: "sys_tab_storage",
    legacyHref: "/integrations/storage",
  },
  {
    id: "sync",
    href: "/admin/system/sync",
    labelKey: "sys_tab_sync",
    legacyHref: "/integrations/log",
  },
  {
    id: "audit",
    href: "/admin/system/audit",
    labelKey: "sys_tab_audit",
    legacyHref: "/settings/audit",
  },
  {
    id: "health",
    href: "/admin/system/health",
    labelKey: "sys_tab_health",
  },
  {
    id: "backups",
    href: "/admin/system/backups",
    labelKey: "sys_tab_backups",
  },
];

export function isSystemTab(value: string): value is SystemTabId {
  return (SYSTEM_TABS as readonly string[]).includes(value);
}

export function systemTabHref(tab: SystemTabId) {
  return `/admin/system/${tab}`;
}
