"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  saveAdminUiPreferencesAction,
  updateAdminProfileAction,
  changeAdminPasswordAction,
} from "@/db/actions";
import type { UiPreferences } from "@/lib/admin-profile-hub";
import { useI18n } from "@/lib/i18n";

type ProfileUser = {
  displayName: string;
  login: string;
  role: string;
  profileJobTitle: string | null;
  profileDepartment: string | null;
  preferredLocale: string;
  avatarData: string | null;
  avatarHue: number;
  profileEmail: string;
  profilePhone: string;
  profileTelegram: string;
};

export function ProfileOverviewPanel({
  user,
  editing = false,
}: {
  user: ProfileUser;
  editing?: boolean;
}) {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const initials = user.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  if (!editing) {
    return (
      <section className="profile-hero panel">
        <div className="profile-hero-main">
          <span
            className="sidebar-user-avatar profile-hero-avatar"
            style={{
              background: user.avatarData
                ? undefined
                : `hsl(${user.avatarHue} 42% 42%)`,
            }}
          >
            {user.avatarData ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarData} alt="" />
            ) : (
              initials || "A"
            )}
          </span>
          <div>
            <h1 className="profile-hero-name">{user.displayName}</h1>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {t("role_admin")} · {user.profileJobTitle || "—"} ·{" "}
              {user.profileDepartment || "—"}
            </p>
            <p className="muted" style={{ margin: "6px 0 0", fontSize: "0.86rem" }}>
              {[user.profileEmail, user.profilePhone, user.profileTelegram]
                .filter(Boolean)
                .join(" · ") || t("prof_no_contacts")}
            </p>
          </div>
        </div>
        <Link href="/admin/profile/overview?edit=1" className="btn btn-primary">
          {t("prof_edit")}
        </Link>
      </section>
    );
  }

  return (
    <section className="panel stack" style={{ gap: 12, maxWidth: 720 }}>
      <h2 style={{ margin: 0 }}>{t("prof_edit")}</h2>
      {error ? <p className="form-error">{error}</p> : null}
      {saved ? <p className="form-success">{t("prof_saved")}</p> : null}
      <form
        className="stack-form"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setSaved(false);
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            try {
              await updateAdminProfileAction(fd);
              setSaved(true);
            } catch (err) {
              setError(err instanceof Error ? err.message : t("prof_save_error"));
            }
          });
        }}
      >
        <label>
          {t("full_name")}
          <input name="displayName" defaultValue={user.displayName} required />
        </label>
        <label>
          {t("portal_login_label")}
          <input name="login" defaultValue={user.login} required />
        </label>
        <label>
          {t("prof_email")}
          <input name="profileEmail" type="email" defaultValue={user.profileEmail} />
        </label>
        <label>
          {t("prof_phone")}
          <input name="profilePhone" defaultValue={user.profilePhone} />
        </label>
        <label>
          Telegram
          <input name="profileTelegram" defaultValue={user.profileTelegram} />
        </label>
        <label>
          {t("prof_job")}
          <input name="profileJobTitle" defaultValue={user.profileJobTitle || ""} />
        </label>
        <label>
          {t("prof_department")}
          <input
            name="profileDepartment"
            defaultValue={user.profileDepartment || ""}
          />
        </label>
        <div className="sys-guide-actions">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? t("prof_saving") : t("prof_save")}
          </button>
          <Link href="/admin/profile/overview" className="btn btn-ghost">
            {t("prof_cancel")}
          </Link>
        </div>
      </form>
    </section>
  );
}

export function ProfileWorkPanel() {
  const { t } = useI18n();
  const items = [
    { href: "/", label: t("prof_work_tasks") },
    { href: "/candidates", label: t("prof_work_candidates") },
    { href: "/interviews", label: t("prof_work_interviews") },
    { href: "/learning-tests", label: t("prof_work_tests") },
    { href: "/interns", label: t("prof_work_reports") },
    { href: "/attestation", label: t("prof_work_attestations") },
    { href: "/learning?focus=overdue", label: t("prof_work_overdue") },
    { href: "/employees", label: t("prof_work_approvals") },
  ];
  return (
    <div className="profile-kpi-grid">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="profile-kpi-card">
          <span>{item.label}</span>
          <strong>→</strong>
        </Link>
      ))}
    </div>
  );
}

export function ProfilePreferencesPanel({
  prefs,
  locale,
}: {
  prefs: UiPreferences;
  locale: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <section className="panel stack" style={{ gap: 12, maxWidth: 720 }}>
      {error ? <p className="form-error">{error}</p> : null}
      {saved ? <p className="form-success">{t("prof_saved")}</p> : null}
      <form
        className="stack-form"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setSaved(false);
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            try {
              await saveAdminUiPreferencesAction(fd);
              setSaved(true);
              router.refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : t("prof_save_error"));
            }
          });
        }}
      >
        <label>
          {t("prof_pref_language")}
          <select name="preferredLocale" defaultValue={locale}>
            <option value="ru">Русский</option>
            <option value="uz">O‘zbekcha</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          {t("prof_pref_theme")}
          <select name="theme" defaultValue={prefs.theme}>
            <option value="light">{t("prof_theme_light")}</option>
            <option value="soft">{t("prof_theme_soft")}</option>
            <option value="contrast">{t("prof_theme_contrast")}</option>
          </select>
        </label>
        <label>
          {t("prof_pref_text")}
          <select name="textSize" defaultValue={prefs.textSize}>
            <option value="sm">{t("prof_text_sm")}</option>
            <option value="md">{t("prof_text_md")}</option>
            <option value="lg">{t("prof_text_lg")}</option>
          </select>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            name="compactTables"
            defaultChecked={prefs.compactTables}
            value="1"
          />
          {t("prof_pref_compact")}
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            name="notificationsEmail"
            defaultChecked={prefs.notificationsEmail}
            value="1"
          />
          {t("prof_pref_notif_email")}
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            name="notificationsTelegram"
            defaultChecked={prefs.notificationsTelegram}
            value="1"
          />
          {t("prof_pref_notif_tg")}
        </label>
        <label>
          {t("prof_pref_tz")}
          <input name="timezone" defaultValue={prefs.timezone} />
        </label>
        <label>
          {t("prof_pref_date")}
          <select name="dateFormat" defaultValue={prefs.dateFormat}>
            <option value="dmy">DD.MM.YYYY</option>
            <option value="ymd">YYYY-MM-DD</option>
            <option value="mdy">MM/DD/YYYY</option>
          </select>
        </label>
        <label>
          {t("prof_pref_home")}
          <select name="homePage" defaultValue={prefs.homePage}>
            <option value="/">{t("nav_admin_desk")}</option>
            <option value="/candidates">{t("nav_admin_hiring")}</option>
            <option value="/employees">{t("nav_admin_staff")}</option>
            <option value="/learning">{t("nav_admin_development")}</option>
            <option value="/admin/system">{t("nav_admin_system")}</option>
          </select>
        </label>
        <label>
          {t("prof_pref_desk")}
          <select name="deskLayout" defaultValue={prefs.deskLayout}>
            <option value="default">{t("prof_desk_default")}</option>
            <option value="ops">{t("prof_desk_ops")}</option>
            <option value="compact">{t("prof_desk_compact")}</option>
          </select>
        </label>
        <div className="sys-guide-actions">
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? t("prof_saving") : t("prof_save")}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending}
            onClick={() => router.push("/admin/profile/overview")}
          >
            {t("prof_cancel")}
          </button>
        </div>
      </form>
    </section>
  );
}

export function ProfileSecurityPanel() {
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  return (
    <div className="stack" style={{ gap: 16, maxWidth: 720 }}>
      <section className="panel stack" style={{ gap: 12 }}>
        <h2 style={{ margin: 0 }}>{t("prof_sec_password")}</h2>
        {error ? <p className="form-error">{error}</p> : null}
        {saved ? <p className="form-success">{t("prof_saved")}</p> : null}
        <form
          className="stack-form"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setSaved(false);
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              try {
                await changeAdminPasswordAction(fd);
                setSaved(true);
                e.currentTarget.reset();
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : t("prof_save_error"),
                );
              }
            });
          }}
        >
          <label>
            {t("prof_sec_current")}
            <input name="currentPassword" type="password" required />
          </label>
          <label>
            {t("prof_sec_new")}
            <input name="newPassword" type="password" minLength={6} required />
          </label>
          <label>
            {t("prof_sec_confirm")}
            <input name="confirmPassword" type="password" minLength={6} required />
          </label>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? t("prof_saving") : t("prof_save")}
          </button>
        </form>
      </section>

      <section className="panel stack" style={{ gap: 10 }}>
        <h2 style={{ margin: 0 }}>{t("prof_sec_2fa")}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {t("prof_sec_2fa_note")}
        </p>
        <button type="button" className="btn btn-ghost" disabled>
          {t("prof_sec_2fa_soon")}
        </button>
      </section>

      <section className="panel stack" style={{ gap: 10 }}>
        <h2 style={{ margin: 0 }}>{t("prof_sec_sessions")}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {t("prof_sec_sessions_note")}
        </p>
        <div className="list-item">
          <div>
            <strong>{t("prof_sec_session_current")}</strong>
            <div className="muted" style={{ fontSize: "0.85rem" }}>
              {t("prof_sec_session_browser")}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
