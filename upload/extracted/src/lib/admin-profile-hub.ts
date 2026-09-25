import type { MessageKey } from "@/lib/i18n";

export const PROFILE_TABS = [
  "overview",
  "work",
  "preferences",
  "activity",
  "security",
] as const;

export type ProfileTabId = (typeof PROFILE_TABS)[number];

export type ProfileTabDef = {
  id: ProfileTabId;
  href: string;
  labelKey: MessageKey;
};

export const PROFILE_TAB_DEFS: ProfileTabDef[] = [
  {
    id: "overview",
    href: "/admin/profile/overview",
    labelKey: "prof_tab_overview",
  },
  { id: "work", href: "/admin/profile/work", labelKey: "prof_tab_work" },
  {
    id: "preferences",
    href: "/admin/profile/preferences",
    labelKey: "prof_tab_preferences",
  },
  {
    id: "activity",
    href: "/admin/profile/activity",
    labelKey: "prof_tab_activity",
  },
  {
    id: "security",
    href: "/admin/profile/security",
    labelKey: "prof_tab_security",
  },
];

export function isProfileTab(value: string): value is ProfileTabId {
  return (PROFILE_TABS as readonly string[]).includes(value);
}

export type UiPreferences = {
  theme: "light" | "soft" | "contrast";
  textSize: "sm" | "md" | "lg";
  compactTables: boolean;
  notificationsEmail: boolean;
  notificationsTelegram: boolean;
  timezone: string;
  dateFormat: "dmy" | "ymd" | "mdy";
  homePage: string;
  deskLayout: string;
};

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  theme: "light",
  textSize: "md",
  compactTables: false,
  notificationsEmail: true,
  notificationsTelegram: true,
  timezone: "Asia/Tashkent",
  dateFormat: "dmy",
  homePage: "/",
  deskLayout: "default",
};

export function parseUiPreferences(raw: string | null | undefined): UiPreferences {
  try {
    const parsed = JSON.parse(raw || "{}") as Partial<UiPreferences>;
    return { ...DEFAULT_UI_PREFERENCES, ...parsed };
  } catch {
    return { ...DEFAULT_UI_PREFERENCES };
  }
}
