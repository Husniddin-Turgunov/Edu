"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AppShell, PageHeader } from "@/components/ui";
import {
  saveIntegrationSettingsAction,
  sendIntegrationProbeAction,
  testIntegrationAction,
} from "@/db/actions";
import { useI18n, type MessageKey } from "@/lib/i18n";
import type { IntegrationSystem } from "@/lib/integrations";

type LogRow = {
  id: number;
  operation: string;
  result: string;
  message: string;
  error: string;
  createdAt: string;
};

const TITLES: Record<IntegrationSystem, MessageKey> = {
  telegram: "ig_telegram_title",
  verifix: "ig_verifix_title",
  bitrix: "ig_bitrix_title",
  smtp: "ig_smtp_title",
  storage: "ig_storage_title",
};

function Check({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="cand-check">
      <input
        type="checkbox"
        name={name}
        value="1"
        defaultChecked={Boolean(defaultChecked)}
      />
      {label}
    </label>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  rows,
  placeholder,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label>
      {label}
      {rows ? (
        <textarea
          name={name}
          rows={rows}
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder}
        />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder}
          autoComplete="off"
        />
      )}
    </label>
  );
}

export function IntegrationsSectionView({
  system,
  config,
  logs,
  extra,
}: {
  system: IntegrationSystem;
  config: Record<string, unknown>;
  logs: LogRow[];
  extra?: {
    vacancies?: { id: number; roleTitle: string }[];
    env?: { drive: boolean; sheets: boolean; blob: boolean; local: boolean };
  };
}) {
  const { t } = useI18n();
  const str = (key: string) =>
    typeof config[key] === "string" ? (config[key] as string) : "";
  const flag = (key: string) => Boolean(config[key]);
  const secretHint = (key: string) =>
    config[`${key}Set`] ? t("ig_secret_set") : t("ig_secret_empty");

  const fields = useMemo(() => {
    if (system === "telegram") {
      return (
        <>
          <Field
            name="token"
            label={`${t("ig_token")} (${secretHint("token")})`}
            type="password"
            placeholder={config.tokenSet ? "••••••••" : ""}
          />
          <Field
            name="webhookSecret"
            label={`${t("ig_webhook_secret")} (${secretHint("webhookSecret")})`}
            type="password"
          />
          <p className="muted">{t("ig_webhook_url")}: /api/integrations/telegram</p>
          <Check
            name="notifyInterviews"
            label={t("ig_notify_interviews")}
            defaultChecked={flag("notifyInterviews")}
          />
          <Check
            name="notifyTests"
            label={t("ig_notify_tests")}
            defaultChecked={flag("notifyTests")}
          />
          <Check
            name="notifyHiring"
            label={t("ig_notify_hiring")}
            defaultChecked={flag("notifyHiring")}
          />
          <Check
            name="formsEnabled"
            label={t("ig_forms")}
            defaultChecked={flag("formsEnabled")}
          />
          <Check
            name="geoEnabled"
            label={t("ig_geo")}
            defaultChecked={flag("geoEnabled")}
          />
          <Field
            name="templateInvite"
            label={t("ig_tpl_invite")}
            rows={8}
            defaultValue={str("templateInvite")}
          />
          <Field
            name="templateTest"
            label={t("ig_tpl_test")}
            rows={3}
            defaultValue={str("templateTest")}
          />
          <Field
            name="templateHired"
            label={t("ig_tpl_hired")}
            rows={3}
            defaultValue={str("templateHired")}
          />
          {extra?.vacancies && extra.vacancies.length > 0 ? (
            <p className="muted">
              {t("ig_vacancies")}:{" "}
              {extra.vacancies
                .slice(0, 8)
                .map((row) => row.roleTitle)
                .join(", ")}
            </p>
          ) : null}
        </>
      );
    }
    if (system === "verifix") {
      return (
        <>
          <Field name="clientId" label={t("ig_client_id")} defaultValue={str("clientId")} />
          <Field
            name="clientSecret"
            label={`${t("ig_client_secret")} (${secretHint("clientSecret")})`}
            type="password"
          />
          <Field name="filialId" label={t("ig_filial_id")} defaultValue={str("filialId")} />
          <Field name="apiBase" label={t("ig_api_url")} defaultValue={str("apiBase")} />
          <div className="form-grid">
            <Field name="tokenPath" label="token" defaultValue={str("tokenPath")} />
            <Field
              name="candidatesPath"
              label={t("ig_path_candidates")}
              defaultValue={str("candidatesPath")}
            />
            <Field
              name="resultsPath"
              label={t("ig_path_results")}
              defaultValue={str("resultsPath")}
            />
            <Field
              name="trialPath"
              label={t("ig_path_trial")}
              defaultValue={str("trialPath")}
            />
            <Field
              name="hirePath"
              label={t("ig_path_hire")}
              defaultValue={str("hirePath")}
            />
          </div>
          <Field
            name="statusMapping"
            label={t("ig_status_map")}
            rows={8}
            defaultValue={str("statusMapping")}
          />
          <Check
            name="transferCandidates"
            label={t("ig_xfer_candidates")}
            defaultChecked={flag("transferCandidates")}
          />
          <Check
            name="transferTestResults"
            label={t("ig_xfer_results")}
            defaultChecked={flag("transferTestResults")}
          />
          <Check
            name="confirmTrial"
            label={t("ig_xfer_trial")}
            defaultChecked={flag("confirmTrial")}
          />
          <Check
            name="hireEmployee"
            label={t("ig_xfer_hire")}
            defaultChecked={flag("hireEmployee")}
          />
        </>
      );
    }
    if (system === "bitrix") {
      return (
        <>
          <Field name="domain" label={t("ig_domain")} defaultValue={str("domain")} />
          <Field
            name="webhook"
            label={`${t("ig_webhook")} (${secretHint("webhook")})`}
            type="password"
          />
          <Check
            name="autoCreateLearningTasks"
            label={t("ig_bx_tasks_auto")}
            defaultChecked={flag("autoCreateLearningTasks")}
          />
          <Check name="syncUsers" label={t("ig_bx_users")} defaultChecked={flag("syncUsers")} />
          <Check
            name="syncDepartments"
            label={t("ig_bx_depts")}
            defaultChecked={flag("syncDepartments")}
          />
          <Check name="syncTasks" label={t("ig_bx_tasks")} defaultChecked={flag("syncTasks")} />
          <Check
            name="syncCalendar"
            label={t("ig_bx_calendar")}
            defaultChecked={flag("syncCalendar")}
          />
          <Check
            name="syncReports"
            label={t("ig_bx_reports")}
            defaultChecked={flag("syncReports")}
          />
        </>
      );
    }
    if (system === "smtp") {
      return (
        <>
          <div className="form-grid">
            <Field name="host" label={t("ig_smtp_host")} defaultValue={str("host")} />
            <Field name="port" label={t("ig_smtp_port")} defaultValue={str("port")} />
            <Field name="user" label={t("ig_smtp_user")} defaultValue={str("user")} />
            <Field
              name="password"
              label={`${t("ig_smtp_password")} (${secretHint("password")})`}
              type="password"
            />
            <Field name="from" label={t("ig_smtp_from")} defaultValue={str("from")} />
          </div>
          <Check name="secure" label={t("ig_smtp_secure")} defaultChecked={flag("secure")} />
          <Field
            name="templateInvite"
            label={t("ig_tpl_invite")}
            rows={3}
            defaultValue={str("templateInvite")}
          />
          <Field
            name="templateReset"
            label={t("ig_tpl_reset")}
            rows={3}
            defaultValue={str("templateReset")}
          />
        </>
      );
    }
    return (
      <>
        {extra?.env ? (
          <p className="muted">
            {[
              extra.env.local ? "Локальный диск: вкл" : "Локальный диск: выкл",
              extra.env.drive ? t("hub_drive_on") : t("hub_drive_off"),
              extra.env.sheets ? t("hub_sheets_on") : t("hub_sheets_off"),
              extra.env.blob ? t("ig_blob_on") : t("ig_blob_off"),
            ].join(" · ")}
          </p>
        ) : null}
        <p>
          <Link href="/learning">{t("hub_integrations_learning")}</Link>
          {" · "}
          <Link href="/assessments">{t("hub_integrations_tests")}</Link>
          {" · "}
          <Link href="/attestation">{t("hub_integrations_attestation")}</Link>
        </p>
        <Field
          name="onedriveClientId"
          label={t("ig_onedrive_id")}
          defaultValue={str("onedriveClientId")}
        />
        <Field
          name="onedriveClientSecret"
          label={`${t("ig_onedrive_secret")} (${secretHint("onedriveClientSecret")})`}
          type="password"
        />
        <Field
          name="onedriveTenant"
          label={t("ig_onedrive_tenant")}
          defaultValue={str("onedriveTenant")}
        />
        <Field
          name="localPath"
          label={t("ig_local_path")}
          defaultValue={str("localPath")}
        />
        <p className="muted">
          Папки внутри: <code>tests/</code> (Excel-тесты), <code>lessons/</code>{" "}
          (Word/Excel уроки), <code>attestations/</code>, <code>design/</code>{" "}
          (медиа), <code>reports/</code>. На сервере можно задать{" "}
          <code>LOCAL_STORAGE_ROOT</code> в .env — он имеет приоритет.
        </p>
        <Check
          name="employeeFoldersEnabled"
          label={t("ig_emp_folders")}
          defaultChecked={flag("employeeFoldersEnabled")}
        />
      </>
    );
  }, [system, config, extra, t]);

  return (
    <AppShell pathname="/integrations">
      <PageHeader title={t(TITLES[system])} subtitle={t("ig_section_note")} />
      <p>
        <Link href="/integrations">{t("ig_back")}</Link>
      </p>
      <section className="layout-2">
        <article className="panel">
          <form action={saveIntegrationSettingsAction} className="stack-form">
            <input type="hidden" name="system" value={system} />
            {fields}
            <button type="submit" className="btn btn-primary">
              {t("ig_save")}
            </button>
          </form>
          <form action={testIntegrationAction} className="stack-form" style={{ marginTop: 12 }}>
            <input type="hidden" name="system" value={system} />
            <button type="submit" className="btn btn-ghost">
              {t("ig_test")}
            </button>
          </form>
        </article>
        <article className="panel">
          <h2>{t("ig_probe_title")}</h2>
          {system === "telegram" ? (
            <form action={sendIntegrationProbeAction} className="stack-form">
              <input type="hidden" name="kind" value="telegram" />
              <Field name="chatId" label="chat_id" />
              <Field name="text" label={t("ig_probe_text")} defaultValue="Проверка AKELA" />
              <button type="submit" className="btn btn-ghost">
                {t("ig_send_probe")}
              </button>
            </form>
          ) : null}
          {system === "smtp" ? (
            <form action={sendIntegrationProbeAction} className="stack-form">
              <input type="hidden" name="kind" value="smtp" />
              <Field name="to" label={t("ig_probe_to")} />
              <Field name="text" label={t("ig_probe_text")} defaultValue="Проверка почты" />
              <button type="submit" className="btn btn-ghost">
                {t("ig_send_probe")}
              </button>
            </form>
          ) : null}
          {system === "verifix" || system === "bitrix" ? (
            <form action={sendIntegrationProbeAction} className="stack-form">
              <input type="hidden" name="kind" value={system} />
              <button type="submit" className="btn btn-ghost">
                {t("ig_send_probe")}
              </button>
            </form>
          ) : null}
          <h2 style={{ marginTop: 18 }}>{t("ig_recent_log")}</h2>
          {logs.length === 0 ? (
            <p className="muted">{t("ig_log_empty")}</p>
          ) : (
            <div className="list">
              {logs.map((row) => (
                <div key={row.id} className="list-item">
                  <div>
                    <strong>
                      {row.result} · {row.operation}
                    </strong>
                    <div className="muted">
                      {new Date(row.createdAt).toLocaleString()} · {row.message}
                      {row.error ? ` · ${row.error}` : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </AppShell>
  );
}
