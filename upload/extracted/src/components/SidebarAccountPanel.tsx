"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { getSidebarAccountAction, logoutAction } from "@/db/actions";
import { useI18n } from "@/lib/i18n";

export function SidebarAccountPanel({ pathname }: { pathname?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [pending, startTransition] = useTransition();
  const [account, setAccount] = useState({
    name: "Администратор",
    role: "admin",
    avatarData: null as string | null,
    avatarHue: 220,
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void getSidebarAccountAction().then((data) => {
      if (data) {
        setAccount({
          name: data.name,
          role: data.role,
          avatarData: data.avatarData,
          avatarHue: data.avatarHue,
        });
      }
    });
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
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

  const initials = account.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  const roleLabel =
    account.role === "admin"
      ? t("role_admin")
      : account.role === "manager"
        ? t("role_manager")
        : t("role_observer");

  return (
    <div className="sidebar-account" ref={rootRef}>
      <Link
        href="/help"
        className={
          pathname?.startsWith("/help")
            ? "sidebar-help-link active"
            : "sidebar-help-link"
        }
      >
        <span aria-hidden>❓</span>
        <span>{t("nav_admin_help")}</span>
      </Link>

      <div className="sidebar-user-card">
        <Link href="/admin/profile/overview" className="sidebar-user-main">
          <span
            className="sidebar-user-avatar"
            style={{
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
          <span className="sidebar-user-text">
            <strong>{account.name}</strong>
            <span className="muted">{roleLabel}</span>
          </span>
        </Link>
        <button
          type="button"
          className="sidebar-user-more"
          aria-label={t("sb_menu_more")}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          ⋮
        </button>
        {open ? (
          <div className="sidebar-user-menu" role="menu">
            <Link
              href="/admin/profile/overview"
              className="sidebar-user-menu-item"
              onClick={() => setOpen(false)}
            >
              {t("sb_menu_profile")}
            </Link>
            <Link
              href="/admin/profile/work"
              className="sidebar-user-menu-item"
              onClick={() => setOpen(false)}
            >
              {t("sb_menu_work")}
            </Link>
            <Link
              href="/admin/profile/preferences"
              className="sidebar-user-menu-item"
              onClick={() => setOpen(false)}
            >
              {t("sb_menu_preferences")}
            </Link>
            <Link
              href="/admin/profile/security"
              className="sidebar-user-menu-item"
              onClick={() => setOpen(false)}
            >
              {t("sb_menu_security")}
            </Link>
            <Link
              href="/help"
              className="sidebar-user-menu-item"
              onClick={() => setOpen(false)}
            >
              {t("nav_admin_help")}
            </Link>
            <button
              type="button"
              className="sidebar-user-menu-item danger"
              onClick={() => {
                setOpen(false);
                setConfirmLogout(true);
              }}
            >
              {t("logout")}
            </button>
          </div>
        ) : null}
      </div>

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
    </div>
  );
}
