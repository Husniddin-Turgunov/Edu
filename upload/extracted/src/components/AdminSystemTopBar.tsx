"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getSidebarAccountAction,
  logoutAction,
} from "@/db/actions";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ADMIN_HUBS, resolveAdminHub } from "@/lib/admin-navigation";
import { useI18n, type MessageKey } from "@/lib/i18n";

type CreateItem = { href: string; labelKey: MessageKey };
type SearchHit = { kind: string; title: string; meta: string; href: string };

const CREATE_HIRING: CreateItem[] = [
  { href: "/candidates", labelKey: "admin_create_candidate" },
  { href: "/vacancies", labelKey: "admin_create_vacancy" },
  { href: "/interviews", labelKey: "admin_create_interview" },
  { href: "/assessments/kind/candidate", labelKey: "admin_create_test" },
  { href: "/trial", labelKey: "admin_create_internship" },
];

const CREATE_STAFF: CreateItem[] = [
  { href: "/employees", labelKey: "admin_create_employee" },
  { href: "/employees?tab=history", labelKey: "admin_create_move" },
  { href: "/employees?tab=people", labelKey: "admin_create_document" },
  { href: "/mentors", labelKey: "admin_create_mentor" },
];

const CREATE_LEARNING: CreateItem[] = [
  { href: "/learning?focus=programs", labelKey: "admin_create_program" },
  { href: "/learning?focus=lessons", labelKey: "admin_create_lesson" },
  { href: "/learning?focus=lessons", labelKey: "admin_create_assignment" },
  { href: "/learning-tests", labelKey: "admin_create_test" },
  { href: "/attestation", labelKey: "admin_create_attestation" },
];

const CREATE_ALL: CreateItem[] = [
  ...CREATE_HIRING,
  ...CREATE_STAFF,
  ...CREATE_LEARNING,
  { href: "/competencies", labelKey: "admin_create_role" },
  { href: "/admin/system/users", labelKey: "admin_create_user" },
];

type SectionContext = {
  titleKey: MessageKey;
  crumbs: { label: string; href?: string }[];
  createItems: CreateItem[];
};

function resolveSection(
  pathname: string | undefined,
  t: (key: MessageKey) => string,
): SectionContext {
  const path = pathname || "/";
  const hub = resolveAdminHub(path);

  if (path === "/" || path === "") {
    return {
      titleKey: "nav_admin_desk",
      crumbs: [{ label: t("nav_admin_desk"), href: "/" }],
      createItems: CREATE_ALL,
    };
  }

  if (path.startsWith("/admin/system") || path.startsWith("/settings") || path.startsWith("/integrations") || path.startsWith("/access") || path.startsWith("/design")) {
    const crumbs: { label: string; href?: string }[] = [
      { label: t("nav_admin_system"), href: "/admin/system" },
    ];
    if (path.includes("user") || path.includes("access")) {
      crumbs.push({ label: t("sys_tab_users"), href: "/admin/system/users" });
    } else if (path.includes("role") || path.includes("permission")) {
      crumbs.push({ label: t("sys_tab_roles"), href: "/admin/system/roles" });
    } else if (path.includes("integration")) {
      crumbs.push({
        label: t("sys_tab_integrations"),
        href: "/admin/system/integrations",
      });
    } else if (path.includes("security")) {
      crumbs.push({ label: t("sys_tab_security"), href: "/admin/system/security" });
    } else if (path.includes("storage")) {
      crumbs.push({ label: t("sys_tab_storage"), href: "/admin/system/storage" });
    } else if (path.includes("audit")) {
      crumbs.push({ label: t("sys_tab_audit"), href: "/admin/system/audit" });
    }
    return {
      titleKey: "nav_admin_system",
      crumbs,
      createItems: [{ href: "/admin/system/users", labelKey: "admin_create_user" }],
    };
  }

  if (path.startsWith("/admin/profile")) {
    const crumbs: { label: string; href?: string }[] = [
      { label: t("nav_admin_profile"), href: "/admin/profile/overview" },
    ];
    if (path.includes("work")) crumbs.push({ label: t("prof_tab_work") });
    else if (path.includes("preference") || path.includes("settings") || path.includes("interface"))
      crumbs.push({ label: t("prof_tab_preferences") });
    else if (path.includes("activity")) crumbs.push({ label: t("prof_tab_activity") });
    else if (path.includes("security")) crumbs.push({ label: t("prof_tab_security") });
    return {
      titleKey: "nav_admin_profile",
      crumbs,
      createItems: CREATE_ALL,
    };
  }

  if (hub?.id === "hiring" || path.startsWith("/candidates") || path.startsWith("/vacancies") || path.startsWith("/interviews") || path.startsWith("/trial")) {
    const crumbs: { label: string; href?: string }[] = [
      { label: t("nav_admin_hiring"), href: "/candidates" },
    ];
    const cand = path.match(/^\/candidates\/([^/]+)/);
    if (cand) {
      crumbs.push({ label: t("admin_tab_candidates"), href: "/candidates" });
      crumbs.push({ label: t("staff_crumb_card") });
    } else if (path.startsWith("/interviews")) {
      crumbs.push({ label: t("admin_tab_interviews"), href: "/interviews" });
    } else if (path.startsWith("/trial") || path.startsWith("/interns")) {
      crumbs.push({ label: t("admin_tab_trial"), href: "/trial" });
    } else if (path.includes("candidate")) {
      crumbs.push({ label: t("admin_tab_candidates"), href: "/candidates" });
    }
    return {
      titleKey: "nav_admin_hiring",
      crumbs,
      createItems: CREATE_HIRING,
    };
  }

  if (hub?.id === "staff" || path.startsWith("/employees") || path.startsWith("/mentors")) {
    const crumbs: { label: string; href?: string }[] = [
      { label: t("nav_admin_staff"), href: "/employees" },
    ];
    const emp = path.match(/^\/employees\/([^/]+)/);
    if (emp) {
      crumbs.push({ label: t("admin_tab_people"), href: "/employees" });
      crumbs.push({ label: t("staff_crumb_card") });
    } else if (path.startsWith("/mentors")) {
      crumbs.push({ label: t("admin_tab_mentors"), href: "/mentors" });
    } else {
      crumbs.push({ label: t("admin_tab_people"), href: "/employees" });
    }
    return {
      titleKey: "nav_admin_staff",
      crumbs,
      createItems: CREATE_STAFF,
    };
  }

  if (hub?.id === "development" || path.startsWith("/learning") || path.startsWith("/attestation")) {
    const crumbs: { label: string; href?: string }[] = [
      { label: t("nav_admin_development"), href: "/learning" },
    ];
    if (path.startsWith("/attestation")) {
      crumbs.push({ label: t("admin_tab_attestations"), href: "/attestation" });
    } else if (path.includes("test")) {
      crumbs.push({ label: t("admin_tab_lesson_tests"), href: "/learning-tests" });
    } else {
      crumbs.push({ label: t("admin_tab_learning_programs"), href: "/learning?focus=programs" });
    }
    return {
      titleKey: "nav_admin_development",
      crumbs,
      createItems: CREATE_LEARNING,
    };
  }

  if (hub) {
    return {
      titleKey: hub.navKey,
      crumbs: [{ label: t(hub.navKey), href: hub.primaryHref }],
      createItems:
        hub.id === "methodology"
          ? [
              { href: "/competencies", labelKey: "admin_create_role" },
              { href: "/assessments", labelKey: "admin_create_test" },
            ]
          : hub.id === "reports"
            ? [{ href: "/reports", labelKey: "admin_create_report" }]
            : CREATE_ALL,
    };
  }

  const fallback = ADMIN_HUBS.find((h) => h.id === "desk")!;
  return {
    titleKey: fallback.navKey,
    crumbs: [{ label: t(fallback.navKey), href: "/" }],
    createItems: CREATE_ALL,
  };
}

export function AdminSystemTopBar({
  pathname,
  notificationCount = 0,
}: {
  pathname?: string;
  notificationCount?: number;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [pending, startTransition] = useTransition();
  const [account, setAccount] = useState({
    name: "Администратор",
    email: "",
    avatarData: null as string | null,
    avatarHue: 220,
  });
  const rootRef = useRef<HTMLElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const section = useMemo(() => resolveSection(pathname, t), [pathname, t]);

  useEffect(() => {
    void getSidebarAccountAction().then((data) => {
      if (data) {
        setAccount({
          name: data.name,
          email: data.email,
          avatarData: data.avatarData,
          avatarHue: data.avatarHue,
        });
      }
    });
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setCreateOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
        setSearchOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setCreateOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
        setSearchOpen(false);
        setConfirmLogout(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimer.current = setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((data: { hits?: SearchHit[] }) => {
          setHits(Array.isArray(data.hits) ? data.hits : []);
          setSearchOpen(true);
        })
        .catch(() => setHits([]))
        .finally(() => setSearchLoading(false));
    }, 220);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearchOpen(false);
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  const initials = account.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <>
      <header className="admin-system-topbar" ref={rootRef}>
        <div className="admin-topbar-left">
          <div className="admin-topbar-title">{t(section.titleKey)}</div>
          <nav className="admin-topbar-crumbs" aria-label="breadcrumb">
            {section.crumbs.map((crumb, i) => (
              <span key={`${crumb.label}-${i}`} className="admin-topbar-crumb">
                {i > 0 ? <span className="admin-topbar-sep">/</span> : null}
                {crumb.href ? (
                  <Link href={crumb.href}>{crumb.label}</Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        </div>

        <div className="admin-topbar-search-wrap">
          <form className="admin-topbar-search" onSubmit={submitSearch}>
            <input
              type="search"
              name="q"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (hits.length) setSearchOpen(true);
              }}
              placeholder={t("admin_search_global_ph")}
              aria-label={t("admin_search_label")}
              autoComplete="off"
            />
          </form>
          {searchOpen && query.trim().length >= 2 ? (
            <div className="admin-topbar-search-results" role="listbox">
              {searchLoading ? (
                <p className="muted admin-topbar-search-empty">{t("admin_search_loading")}</p>
              ) : hits.length === 0 ? (
                <p className="muted admin-topbar-search-empty">{t("admin_search_empty")}</p>
              ) : (
                hits.map((hit, index) => (
                  <Link
                    key={`${hit.href}-${index}`}
                    href={hit.href}
                    className="admin-topbar-search-hit"
                    role="option"
                    onClick={() => {
                      setSearchOpen(false);
                      setQuery("");
                    }}
                  >
                    <strong>{hit.title}</strong>
                    <span className="muted">
                      {hit.kind}
                      {hit.meta ? ` · ${hit.meta}` : ""}
                    </span>
                  </Link>
                ))
              )}
              <button
                type="button"
                className="admin-topbar-search-all"
                onClick={() => {
                  setSearchOpen(false);
                  router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                }}
              >
                {t("admin_search_all")}
              </button>
            </div>
          ) : null}
        </div>

        <div className="admin-topbar-right">
          <div className="admin-create-wrap">
            <button
              type="button"
              className="btn btn-primary admin-topbar-create"
              onClick={() => {
                setCreateOpen((v) => !v);
                setNotifOpen(false);
                setProfileOpen(false);
              }}
              aria-expanded={createOpen}
            >
              {t("admin_create_btn")}
            </button>
            {createOpen ? (
              <div className="admin-create-menu" role="menu">
                {section.createItems.map((item) => (
                  <Link
                    key={`${item.href}-${item.labelKey}`}
                    href={item.href}
                    className="admin-create-item"
                    role="menuitem"
                    onClick={() => setCreateOpen(false)}
                  >
                    {t(item.labelKey)}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="admin-topbar-icon-wrap">
            <button
              type="button"
              className="admin-topbar-icon-btn"
              aria-label={t("admin_notifications_btn")}
              aria-expanded={notifOpen}
              onClick={() => {
                setNotifOpen((v) => !v);
                setCreateOpen(false);
                setProfileOpen(false);
              }}
            >
              <span aria-hidden>🔔</span>
              {notificationCount > 0 ? (
                <span className="admin-topbar-badge">{notificationCount}</span>
              ) : null}
            </button>
            {notifOpen ? (
              <div className="admin-topbar-dropdown admin-topbar-notif">
                <p className="muted" style={{ margin: "0 0 8px" }}>
                  {notificationCount > 0
                    ? t("admin_notif_count").replace(
                        "{n}",
                        String(notificationCount),
                      )
                    : t("admin_notif_empty")}
                </p>
                <Link
                  href="/admin/system/notifications"
                  className="btn btn-ghost"
                  onClick={() => setNotifOpen(false)}
                >
                  {t("admin_notifications_btn")}
                </Link>
              </div>
            ) : null}
          </div>

          <div className="admin-topbar-lang">
            <LanguageSwitcher />
          </div>

          <div className="admin-topbar-user-wrap">
            <button
              type="button"
              className="admin-topbar-user"
              aria-expanded={profileOpen}
              onClick={() => {
                setProfileOpen((v) => !v);
                setCreateOpen(false);
                setNotifOpen(false);
              }}
            >
              <span
                className="sidebar-user-avatar"
                style={{
                  width: 32,
                  height: 32,
                  background: account.avatarData
                    ? undefined
                    : `hsl(${account.avatarHue} 42% 42%)`,
                }}
              >
                {account.avatarData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={account.avatarData} alt="" />
                ) : (
                  initials || "A"
                )}
              </span>
              <span className="admin-topbar-user-name">{account.name}</span>
              <span aria-hidden>▼</span>
            </button>
            {profileOpen ? (
              <div className="admin-topbar-dropdown" role="menu">
                <Link
                  href="/admin/profile/overview"
                  className="sidebar-user-menu-item"
                  onClick={() => setProfileOpen(false)}
                >
                  {t("sb_menu_profile")}
                </Link>
                <Link
                  href="/admin/profile/work"
                  className="sidebar-user-menu-item"
                  onClick={() => setProfileOpen(false)}
                >
                  {t("sb_menu_work")}
                </Link>
                <Link
                  href="/admin/profile/preferences"
                  className="sidebar-user-menu-item"
                  onClick={() => setProfileOpen(false)}
                >
                  {t("sb_menu_preferences")}
                </Link>
                <Link
                  href="/admin/profile/security"
                  className="sidebar-user-menu-item"
                  onClick={() => setProfileOpen(false)}
                >
                  {t("sb_menu_security")}
                </Link>
                <Link
                  href="/help"
                  className="sidebar-user-menu-item"
                  onClick={() => setProfileOpen(false)}
                >
                  {t("nav_admin_help")}
                </Link>
                <button
                  type="button"
                  className="sidebar-user-menu-item danger"
                  onClick={() => {
                    setProfileOpen(false);
                    setConfirmLogout(true);
                  }}
                >
                  {t("logout")}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {confirmLogout ? (
        <div className="sidebar-logout-overlay" role="dialog" aria-modal="true">
          <div className="sidebar-logout-dialog">
            <p>{t("sb_logout_confirm")}</p>
            <div className="sidebar-logout-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmLogout(false)}
                disabled={pending}
              >
                {t("sb_logout_stay")}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={pending}
                onClick={() =>
                  startTransition(() => {
                    void logoutAction();
                  })
                }
              >
                {t("logout")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
