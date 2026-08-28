"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect } from "react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useCompany } from "@/components/CompanyProvider";
import { AdminHubTabs } from "@/components/AdminHubTabs";
import { AdminSystemTopBar } from "@/components/AdminSystemTopBar";
import { SidebarAccountPanel } from "@/components/SidebarAccountPanel";
import { adminSidebarLinks } from "@/lib/admin-navigation";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { logoutAction } from "@/db/actions";

type AdminNavLink = {
  href: string;
  key: MessageKey;
  match?: string[];
};

const adminLinks: AdminNavLink[] = adminSidebarLinks();

const statsLinks: { href: string; key: MessageKey }[] = [
  { href: "/observer/profile", key: "nav_profile" },
  { href: "/observer", key: "nav_statistics" },
];

const managerLinks: { href: string; key: MessageKey; match?: string[] }[] = [
  { href: "/observer/home", key: "nav_mgr_home" },
  { href: "/observer/team", key: "nav_mgr_team", match: ["/observer/team"] },
  { href: "/observer/tasks", key: "nav_mgr_tasks" },
  {
    href: "/observer/newcomers",
    key: "nav_mgr_newcomers",
    match: ["/observer/newcomers", "/observer/trial"],
  },
  { href: "/observer/training", key: "nav_mgr_training" },
  { href: "/observer/kpi", key: "nav_mgr_kpi" },
  {
    href: "/observer/attestations",
    key: "nav_mgr_attestations",
    match: ["/observer/attestations", "/observer/approvals"],
  },
  { href: "/observer/meetings", key: "nav_mgr_meetings" },
  { href: "/observer/mentees", key: "nav_mentees" },
  { href: "/observer/growth", key: "nav_mgr_growth" },
  { href: "/observer/reports", key: "nav_mgr_reports" },
  { href: "/observer/notifications", key: "nav_mgr_notifications" },
  { href: "/observer/profile", key: "nav_profile" },
];

const employeeLinks: { href: string; key: MessageKey; match?: string[] }[] = [
  { href: "/my", key: "nav_overview" },
  {
    href: "/my/start",
    key: "nav_my_start",
    match: ["/my/start", "/my/company"],
  },
  { href: "/my/tasks", key: "nav_my_tasks" },
  {
    href: "/my/learning",
    key: "nav_my_learning",
    match: ["/my/learning", "/my/tests"],
  },
  { href: "/my/mentor", key: "nav_my_mentor" },
  { href: "/my/statistics", key: "nav_my_progress" },
  { href: "/my/attestation", key: "nav_my_attestations" },
  { href: "/my/calendar", key: "nav_my_calendar" },
  { href: "/my/docs", key: "nav_my_docs" },
  { href: "/my/profile", key: "nav_profile" },
  { href: "/my/notifications", key: "nav_my_notifications" },
];

const internLinks: { href: string; key: MessageKey }[] = [
  { href: "/my/profile", key: "nav_profile" },
  { href: "/my/statistics", key: "nav_my_statistics" },
  { href: "/my/learning", key: "nav_learning_level" },
  { href: "/my/tests", key: "nav_my_tests" },
  { href: "/my/daily-report", key: "nav_daily_report" },
];

function isNavActive(
  pathname: string | undefined,
  link: { href: string; match?: string[] },
) {
  if (!pathname) return false;
  if (link.href === "/" || link.href === "/my") return pathname === link.href;
  const prefixes = link.match ?? [link.href];
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function applyThemeHue(hue: number | null | undefined) {
  const root = document.documentElement;
  if (hue == null || !Number.isFinite(hue)) {
    root.style.removeProperty("--brand");
    root.style.removeProperty("--brand-deep");
    root.style.removeProperty("--brand-soft");
    root.style.removeProperty("--brand-mist");
    root.style.removeProperty("--bg-0");
    root.style.removeProperty("--bg-1");
    root.style.removeProperty("--line");
    root.style.removeProperty("--brand-glow");
    root.style.removeProperty("--brand-glow-soft");
    root.style.removeProperty("--tone-middle");
    root.style.removeProperty("--tone-senior");
    root.style.removeProperty("--shadow");
    return;
  }

  const h = Math.max(0, Math.min(359, Math.round(hue)));
  root.style.setProperty("--brand", `hsl(${h} 48% 42%)`);
  root.style.setProperty("--brand-deep", `hsl(${h} 48% 32%)`);
  root.style.setProperty("--brand-soft", `hsl(${h} 35% 58%)`);
  root.style.setProperty("--brand-mist", `hsl(${h} 35% 82%)`);
  root.style.setProperty("--bg-0", `hsl(${h} 32% 93%)`);
  root.style.setProperty("--bg-1", `hsl(${h} 40% 97%)`);
  root.style.setProperty("--line", `hsla(${h}, 35%, 42%, 0.2)`);
  root.style.setProperty("--brand-glow", `hsla(${h}, 48%, 42%, 0.22)`);
  root.style.setProperty("--brand-glow-soft", `hsla(${h}, 35%, 58%, 0.18)`);
  root.style.setProperty("--tone-middle", `hsl(${h} 35% 58%)`);
  root.style.setProperty("--tone-senior", `hsl(${h} 48% 42%)`);
  root.style.setProperty("--shadow", `0 16px 40px hsla(${h}, 40%, 28%, 0.1)`);
}

export type AppShellRole =
  | "admin"
  | "observer"
  | "manager"
  | "employee"
  | "intern";

export function AppShell({
  children,
  pathname,
  role = "admin",
  themeHue,
}: {
  children: React.ReactNode;
  pathname?: string;
  role?: AppShellRole;
  themeHue?: number | null;
}) {
  const { t } = useI18n();
  const company = useCompany();
  const isStatsRole = role === "observer" || role === "manager";
  const isParticipantRole = role === "employee" || role === "intern";
  const themed = isStatsRole || isParticipantRole;
  const links =
    role === "manager"
      ? managerLinks
      : isStatsRole
        ? statsLinks
        : role === "intern"
          ? internLinks
          : role === "employee"
            ? employeeLinks
            : adminLinks;
  const homeHref = isStatsRole
    ? "/observer/home"
    : isParticipantRole
      ? "/my"
      : role === "admin"
        ? "/"
        : "/design";
  const showAdminHubTabs =
    role === "admin" &&
    pathname !== "/" &&
    !pathname?.startsWith("/admin/profile") &&
    !pathname?.startsWith("/admin/system") &&
    pathname !== "/help" &&
    pathname !== "/search";

  useEffect(() => {
    if (themed) applyThemeHue(themeHue ?? 220);
    else applyThemeHue(null);
    return () => {
      applyThemeHue(null);
    };
  }, [themed, themeHue]);

  if (role === "admin") {
    return (
      <div className="shell shell-admin">
        <aside className="sidebar">
          <Link
            href={homeHref}
            className="brand"
            aria-label={t("overview_title")}
          >
            <Image
              src={company.logoUrl || "/akela-logo.png?v=nobox"}
              alt={company.name || "AKELA — Bridging the world business"}
              width={528}
              height={306}
              className="brand-logo"
              priority
              unoptimized
            />
          </Link>
          <p className="sidebar-tagline">{company.name || "Assess"}</p>
          {t("sidebar_note") ? (
            <p className="sidebar-note">{t("sidebar_note")}</p>
          ) : null}
          <nav className="nav">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  isNavActive(pathname, link) ? "nav-link active" : "nav-link"
                }
              >
                {t(link.key)}
              </Link>
            ))}
          </nav>
          <div className="sidebar-foot">
            <SidebarAccountPanel pathname={pathname} />
          </div>
        </aside>
        <div className="shell-admin-main">
          <AdminSystemTopBar pathname={pathname} />
          <main className="main">
            {showAdminHubTabs ? (
              <Suspense fallback={null}>
                <AdminHubTabs pathname={pathname} />
              </Suspense>
            ) : null}
            {children}
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link
          href={homeHref}
          className="brand"
          aria-label={t("overview_title")}
        >
          <Image
            src={company.logoUrl || "/akela-logo.png?v=nobox"}
            alt={company.name || "AKELA — Bridging the world business"}
            width={528}
            height={306}
            className="brand-logo"
            priority
            unoptimized
          />
        </Link>
        <p className="sidebar-tagline">{company.name || "Assess"}</p>
        {!themed && t("sidebar_note") ? (
          <p className="sidebar-note">{t("sidebar_note")}</p>
        ) : null}
        <nav className="nav">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                isNavActive(pathname, link) ? "nav-link active" : "nav-link"
              }
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <form action={logoutAction}>
            <button type="submit" className="btn btn-ghost sidebar-logout">
              {t("logout")}
            </button>
          </form>
        </div>
      </aside>
      <main className="main">
        <div className="lang-corner">
          <LanguageSwitcher />
        </div>
        {children}
      </main>
    </div>
  );
}

export function LevelBadge({ level }: { level: string }) {
  const { t } = useI18n();
  return (
    <span className={`level-badge level-${level}`}>
      {level === "unassessed"
        ? t("unassessed")
        : level === "intern"
          ? t("role_intern")
          : level}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}
