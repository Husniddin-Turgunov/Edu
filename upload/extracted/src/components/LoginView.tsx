"use client";

import Image from "next/image";
import { requestPasswordResetAction } from "@/db/actions";
import { useCompany } from "@/components/CompanyProvider";
import { LOCALES, useI18n, type Locale } from "@/lib/i18n";

export function LoginView({
  error,
  reset,
  consentRequired,
}: {
  error?: string;
  reset?: boolean;
  consentRequired?: boolean;
}) {
  const { t, locale, setLocale } = useI18n();
  const company = useCompany();
  const errorText =
    error === "invalid"
      ? t("login_error")
      : error === "missing"
        ? t("login_missing")
        : error === "consent"
          ? t("login_consent_error")
          : error === "server"
            ? t("login_error")
            : null;

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <Image
            src={company.logoUrl || "/akela-logo.png?v=nobox"}
            alt={company.name || "AKELA"}
            width={220}
            height={128}
            className="brand-logo"
            priority
            unoptimized
          />
          <p className="login-tag">{company.name || t("login_platform_tag")}</p>
        </div>

        <h1>{t("login_title")}</h1>
        <p className="muted">{t("login_subtitle")}</p>

        <form action="/login/submit" method="post" className="stack-form">
          <label>
            {t("login_label")}
            <input name="login" required autoComplete="username" />
          </label>
          <label>
            {t("login_password_label")}
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          <label>
            {t("lang")}
            <select
              name="locale"
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              required
            >
              {LOCALES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.flag} {item.label}
                </option>
              ))}
            </select>
          </label>
          {consentRequired ? (
            <label className="cand-check">
              <input type="checkbox" name="consent" value="1" />
              {t("login_consent")}
            </label>
          ) : null}
          {errorText ? <p className="error">{errorText}</p> : null}
          {reset ? <p className="muted">{t("login_reset_done")}</p> : null}
          <button type="submit" className="btn btn-primary">
            {t("login_btn")}
          </button>
        </form>

        <form action={requestPasswordResetAction} className="stack-form" style={{ marginTop: 16 }}>
          <label>
            {t("login_label")}
            <input name="login" required autoComplete="username" />
          </label>
          <p className="muted">{t("login_reset_note")}</p>
          <button type="submit" className="btn btn-ghost">
            {t("login_reset")}
          </button>
        </form>

        <div className="login-roles">
          <span>{t("login_roles_hint")}</span>
        </div>
      </div>
    </div>
  );
}
