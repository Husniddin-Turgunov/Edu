"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { logoutAction } from "@/db/actions";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";

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

export function ParticipantShell({
  children,
  pathname = "/my",
  themeHue = 220,
  showProfileNav = true,
}: {
  children: React.ReactNode;
  pathname?: string;
  themeHue?: number | null;
  showProfileNav?: boolean;
}) {
  const { t } = useI18n();

  useEffect(() => {
    applyThemeHue(themeHue ?? 220);
    return () => {
      applyThemeHue(null);
    };
  }, [themeHue]);

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <Link href="/my" className="portal-brand">
          <Image
            src="/akela-logo.png?v=nobox"
            alt="AKELA"
            width={160}
            height={92}
            className="portal-brand-logo"
            unoptimized
          />
        </Link>
        {showProfileNav ? (
          <nav className="portal-nav" aria-label={t("nav_profile")}>
            <Link
              href="/my/profile"
              className={
                pathname === "/my/profile"
                  ? "portal-nav-link active"
                  : "portal-nav-link"
              }
            >
              {t("nav_profile")}
            </Link>
            <Link
              href="/my"
              className={
                pathname === "/my" ? "portal-nav-link active" : "portal-nav-link"
              }
            >
              {t("participant_area")}
            </Link>
          </nav>
        ) : null}
        <div className="portal-header-meta">
          <LanguageSwitcher />
          <form action={logoutAction}>
            <button type="submit" className="btn btn-ghost">
              {t("logout")}
            </button>
          </form>
        </div>
      </header>
      <main className="portal-main">{children}</main>
    </div>
  );
}
