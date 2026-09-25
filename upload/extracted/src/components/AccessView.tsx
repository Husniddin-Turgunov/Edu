"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/ui";
import { createPlatformAccountAction, setPlatformUserActiveAction } from "@/db/actions";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";

type PlatformUser = {
  id: number;
  login: string;
  passwordPlain?: string | null;
  displayName: string;
  role: string;
  participantKind: string | null;
  isActive: boolean;
  slotNumber?: number;
  terminalStatus?: string;
  currentCandidate?: string | null;
};

type PersonOption = {
  id: number;
  name: string;
  subtitle: string;
};

type CreatedFlash = {
  login: string;
  password: string;
  name: string;
  type: string;
};

const ACCOUNT_TYPE_LABEL: Record<string, MessageKey> = {
  admin: "role_admin",
  observer: "role_observer",
  manager: "role_manager",
  candidate: "role_candidate",
  employee: "role_employee",
  intern: "role_intern",
};

function roleDisplayKey(user: PlatformUser): MessageKey {
  if (user.role === "terminal") return "role_candidate";
  if (user.role === "admin") return "role_admin";
  if (user.role === "manager") return "role_manager";
  if (user.role === "observer") return "role_observer";
  if (user.participantKind === "intern") return "role_intern";
  if (user.participantKind === "candidate") return "role_candidate";
  return "role_employee";
}

export function AccessView({
  users,
  candidates,
  employees,
  entryUrl,
  createdFlash,
  embedded = false,
}: {
  users: PlatformUser[];
  candidates: PersonOption[];
  employees: PersonOption[];
  entryUrl: string;
  createdFlash?: CreatedFlash | null;
  embedded?: boolean;
}) {
  const { t, locale } = useI18n();
  const [accountType, setAccountType] = useState("observer");

  const needsPerson =
    accountType === "employee" || accountType === "intern";
  const needsName =
    accountType === "admin" ||
    accountType === "observer" ||
    accountType === "manager";
  const people = employees;

  const body = (
    <>
      {!embedded ? (
        <PageHeader title={t("access_title")} subtitle={t("access_subtitle")} />
      ) : null}

      {createdFlash ? (
        <section className="panel portal-flash" style={{ marginBottom: 18 }}>
          <h2>{t("access_account_created")}</h2>
          <p className="muted">{t("portal_access_created_note")}</p>
          <dl className="portal-creds">
            <div>
              <dt>{t("access_account_type")}</dt>
              <dd>
                {t(
                  ACCOUNT_TYPE_LABEL[createdFlash.type] ?? "role_participant",
                )}
              </dd>
            </div>
            <div>
              <dt>{t("full_name")}</dt>
              <dd>
                <strong>{createdFlash.name}</strong>
              </dd>
            </div>
            <div>
              <dt>{t("portal_login_label")}</dt>
              <dd>
                <code>{createdFlash.login}</code>
              </dd>
            </div>
            <div>
              <dt>{t("portal_password_label")}</dt>
              <dd>
                <code>{createdFlash.password}</code>
              </dd>
            </div>
            <div>
              <dt>{t("portal_entry_url")}</dt>
              <dd>
                <Link href="/login">{entryUrl}</Link>
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="layout-2">
        <article className="panel">
          <h2>{t("access_create_account")}</h2>
          <p className="muted">{t("access_create_account_note")}</p>
          <form action={createPlatformAccountAction} className="stack-form">
            <label>
              {t("access_account_type")}
              <select
                name="accountType"
                required
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
              >
                <option value="admin">{t("role_admin")}</option>
                <option value="observer">{t("role_observer")}</option>
                <option value="manager">{t("role_manager")}</option>
                <option value="employee">{t("role_employee")}</option>
                <option value="intern">{t("role_intern")}</option>
              </select>
            </label>

            {needsName ? (
              <label>
                {t("full_name")}
                <input name="displayName" required placeholder="…" />
              </label>
            ) : null}

            {needsPerson ? (
              <label>
                {t("col_employee")}
                <select name="personId" required defaultValue="">
                  <option value="" disabled>
                    {t("select")}
                  </option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {localizeStaffText(p.name, locale, "name")} —{" "}
                      {localizeStaffText(p.subtitle, locale, "role")}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label>
              {t("portal_login_label")}
              <input
                name="login"
                placeholder={t("portal_login_placeholder")}
                autoComplete="off"
              />
            </label>
            <label>
              {t("portal_password_label")}
              <input
                name="password"
                placeholder={t("portal_password_placeholder")}
                autoComplete="new-password"
              />
            </label>
            <p className="muted">{t("portal_access_hint")}</p>
            <button type="submit" className="btn btn-primary">
              {t("access_create_btn")}
            </button>
          </form>
        </article>

        <article className="panel">
          <h2>{t("access_login_url")}</h2>
          <p className="muted">{t("access_login_url_note")}</p>
          <p>
            <Link href="/login" className="btn btn-ghost">
              {entryUrl}
            </Link>
          </p>
          <ul className="access-roles muted">
            <li>{t("role_admin")}</li>
            <li>{t("role_observer")}</li>
            <li>{t("role_manager")}</li>
            <li>{t("role_employee")}</li>
            <li>{t("role_intern")}</li>
            <li>{t("role_candidate")}</li>
          </ul>
        </article>
      </section>

      <section className="panel table-wrap">
        <h2>{t("access_accounts_list")}</h2>
        {users.length === 0 ? (
          <p className="muted">{t("access_accounts_empty")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("full_name")}</th>
                <th>{t("access_account_type")}</th>
                <th>{t("portal_login_label")}</th>
                <th>{t("portal_password_label")}</th>
                <th>{t("col_status")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.displayName}</td>
                  <td>{t(roleDisplayKey(u))}</td>
                  <td>
                    {u.role === "terminal" ? (
                      <span>
                        <code>{u.login}</code>{" "}
                        <Link href={u.login} target="_blank">
                          {t("terminal_open")}
                        </Link>
                      </span>
                    ) : (
                      <code>{u.login}</code>
                    )}
                  </td>
                  <td>
                    {u.role === "terminal" ? (
                      <span className="muted">—</span>
                    ) : u.passwordPlain ? (
                      <code>{u.passwordPlain}</code>
                    ) : (
                      <span className="muted">{t("access_password_unknown")}</span>
                    )}
                  </td>
                  <td>
                    {u.role === "terminal"
                      ? u.currentCandidate
                        ? `${u.currentCandidate} · ${
                            u.terminalStatus === "testing"
                              ? t("terminal_status_testing")
                              : t("terminal_status_active")
                          }`
                        : t("terminal_slot_free")
                      : u.isActive
                        ? t("portal_enabled")
                        : t("portal_disabled")}
                    {u.role !== "terminal" && u.id > 0 ? (
                      <form action={setPlatformUserActiveAction} style={{ marginTop: 6 }}>
                        <input type="hidden" name="userId" value={u.id} />
                        <input
                          type="hidden"
                          name="isActive"
                          value={u.isActive ? "0" : "1"}
                        />
                        <button type="submit" className="btn btn-ghost">
                          {u.isActive ? t("st_user_block") : t("st_user_unblock")}
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );

  if (embedded) return body;
  return <AppShell pathname="/access">{body}</AppShell>;
}
