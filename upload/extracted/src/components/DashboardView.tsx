"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell, PageHeader } from "@/components/ui";
import { DeferredCanvas } from "@/components/DeferredCanvas";
import type { HrDashboardStats } from "@/db/queries";
import { useI18n, type MessageKey } from "@/lib/i18n";
import type { FunnelStageId } from "@/lib/candidate-funnel";
import { FUNNEL_STAGE_HREFS } from "@/lib/candidate-funnel";
import type { RoleHomeDocument } from "@/lib/role-home";

const KPI_ITEMS: {
  key: keyof HrDashboardStats["kpis"];
  labelKey: MessageKey;
  href: string;
}[] = [
  { key: "newCandidates", labelKey: "dash_kpi_new_candidates", href: "/candidates" },
  { key: "underReview", labelKey: "dash_kpi_under_review", href: "/candidates" },
  {
    key: "interviewsToday",
    labelKey: "dash_kpi_interviews_today",
    href: "/interviews",
  },
  { key: "awaitingTest", labelKey: "dash_kpi_awaiting_test", href: "/candidates" },
  {
    key: "testsCompleted",
    labelKey: "dash_kpi_tests_completed",
    href: "/results",
  },
  { key: "onTrial5Days", labelKey: "dash_kpi_trial", href: "/trial" },
  {
    key: "onLearning3Months",
    labelKey: "dash_kpi_learning",
    href: "/learning",
  },
  {
    key: "upcomingAttestations",
    labelKey: "dash_kpi_upcoming_attestation",
    href: "/attestation",
  },
  {
    key: "overdueAssignments",
    labelKey: "dash_kpi_overdue",
    href: "/learning?focus=overdue",
  },
  {
    key: "confirmedMiddle",
    labelKey: "dash_kpi_middle",
    href: "/employees",
  },
];

const FUNNEL_LABEL_KEYS: Record<FunnelStageId, MessageKey> = {
  telegram_form: "dash_funnel_telegram",
  verifix: "dash_funnel_verifix",
  invited: "dash_funnel_invited",
  interview_confirmed: "dash_funnel_interview_confirmed",
  interview_passed: "dash_funnel_interview",
  test_assigned: "dash_funnel_test_assigned",
  test_completed: "dash_funnel_test",
  trial_admitted: "dash_funnel_trial",
  trial_completed: "dash_funnel_trial_completed",
  hired: "dash_funnel_hired",
  learning_3m: "dash_funnel_learning",
  attestation_ready: "dash_funnel_attestation_ready",
  middle_confirmed: "dash_funnel_middle",
};

const BLOCK_KEYS = [
  "kpis",
  "tasks",
  "decisions",
  "warnings",
  "funnel",
  "trial",
  "learning",
  "events",
  "company",
  "integrations",
] as const;

type BlockId = (typeof BLOCK_KEYS)[number];

const BLOCK_TITLES: Record<BlockId, MessageKey> = {
  kpis: "dash_kpis_title",
  tasks: "dash_tasks_title",
  decisions: "dash_decisions_title",
  warnings: "dash_warnings_title",
  funnel: "dash_funnel_title",
  trial: "dash_trial_block_title",
  learning: "dash_learning_block_title",
  events: "dash_events_title",
  company: "dash_company_title",
  integrations: "dash_integrations_title",
};

const DEFAULT_LAYOUT: BlockId[] = [...BLOCK_KEYS];
const PRESETS: { id: string; labelKey: MessageKey; blocks: BlockId[] }[] = [
  {
    id: "day",
    labelKey: "dash_preset_day",
    blocks: ["tasks", "decisions", "warnings", "events", "kpis"],
  },
  {
    id: "hr",
    labelKey: "dash_preset_hr",
    blocks: ["funnel", "tasks", "decisions", "trial", "warnings"],
  },
  {
    id: "learning",
    labelKey: "dash_preset_learning",
    blocks: ["learning", "events", "warnings", "tasks"],
  },
  {
    id: "exec",
    labelKey: "dash_preset_exec",
    blocks: ["company", "funnel", "learning", "integrations", "kpis"],
  },
  { id: "full", labelKey: "dash_preset_full", blocks: DEFAULT_LAYOUT },
];

const STORAGE_KEY = "akela-admin-desk-layout-v1";

function loadLayout(): BlockId[] {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as string[];
    const valid = parsed.filter((id): id is BlockId =>
      BLOCK_KEYS.includes(id as BlockId),
    );
    return valid.length ? valid : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

function ActionRow({
  item,
  tone,
}: {
  item: HrDashboardStats["tasks"][number];
  tone?: "critical" | "warn" | "ok" | "info";
}) {
  const { t } = useI18n();
  return (
    <div
      className={`list-item dash-action-row${tone ? ` dash-tone-${tone}` : ""}`}
    >
      <Link href={item.href} className="dash-action-main">
        <strong>{t(item.titleKey)}</strong>
        {item.detail ? (
          <div className="muted" style={{ marginTop: 4, fontSize: "0.85rem" }}>
            {item.detail}
          </div>
        ) : null}
      </Link>
      {!item.detail && item.count > 1 ? (
        <strong className="dash-action-count">{item.count}</strong>
      ) : null}
      {item.actions && item.actions.length > 0 ? (
        <div className="dash-action-btns">
          {item.actions.map((action) => (
            <Link
              key={`${item.id}-${action.labelKey}-${action.href}`}
              href={action.href}
              className="btn btn-ghost dash-mini-btn"
            >
              {t(action.labelKey)}
            </Link>
          ))}
        </div>
      ) : (
        <Link href={item.href} className="btn btn-ghost dash-mini-btn">
          {t("dash_act_open")}
        </Link>
      )}
    </div>
  );
}

function Meter({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} className="dash-meter">
      <span>{label}</span>
      <strong>{value}</strong>
    </Link>
  );
}

export function DashboardView({
  stats,
  permanentDocument,
}: {
  stats: HrDashboardStats;
  permanentDocument?: RoleHomeDocument | null;
}) {
  const { t, locale } = useI18n();
  const searchParams = useSearchParams();
  const customize = searchParams?.get("customize") === "1";
  const [layout, setLayout] = useState<BlockId[]>(DEFAULT_LAYOUT);
  const [calendarMode, setCalendarMode] = useState<"day" | "week" | "month">(
    "week",
  );

  useEffect(() => {
    setLayout(loadLayout());
  }, []);

  const maxFunnel = Math.max(1, ...stats.funnel.map((s) => s.count));
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";

  function saveLayout(next: BlockId[]) {
    setLayout(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function toggleBlock(id: BlockId) {
    if (layout.includes(id)) {
      saveLayout(layout.filter((item) => item !== id));
    } else {
      saveLayout([...layout, id]);
    }
  }

  function moveBlock(id: BlockId, dir: -1 | 1) {
    const index = layout.indexOf(id);
    if (index < 0) return;
    const next = [...layout];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    saveLayout(next);
  }

  const visible = customize ? BLOCK_KEYS : layout;

  const blocks: Record<BlockId, React.ReactNode> = {
    kpis: (
      <section className="stack" style={{ gap: 8 }}>
        <h2 className="dash-section-title">{t("dash_kpis_title")}</h2>
        <div className="grid-stats dash-kpi-grid">
          {KPI_ITEMS.map((item) => (
            <Link key={item.key} href={item.href} className="stat dash-stat-link">
              <span>{t(item.labelKey)}</span>
              <strong>{stats.kpis[item.key]}</strong>
            </Link>
          ))}
        </div>
      </section>
    ),
    tasks: (
      <article className="panel">
        <h2>{t("dash_tasks_title")}</h2>
        {stats.tasks.length === 0 ? (
          <p className="muted">{t("dash_tasks_empty")}</p>
        ) : (
          <div className="list dash-action-list">
            {stats.tasks.map((task) => (
              <ActionRow key={task.id} item={task} />
            ))}
          </div>
        )}
      </article>
    ),
    decisions: (
      <article className="panel">
        <h2>{t("dash_decisions_title")}</h2>
        {stats.decisions.length === 0 ? (
          <p className="muted">{t("dash_decisions_empty")}</p>
        ) : (
          <div className="list dash-action-list">
            {stats.decisions.map((item) => (
              <ActionRow key={item.id} item={item} tone="warn" />
            ))}
          </div>
        )}
      </article>
    ),
    warnings: (
      <article className="panel">
        <h2>{t("dash_warnings_title")}</h2>
        {stats.warnings.length === 0 ? (
          <p className="muted">{t("dash_warnings_empty")}</p>
        ) : (
          <div className="list">
            {stats.warnings.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="list-item dash-action-link dash-warning-item dash-tone-critical"
              >
                <div>
                  <strong>{t(item.titleKey)}</strong>
                </div>
                <strong className="dash-action-count">{item.count}</strong>
              </Link>
            ))}
          </div>
        )}
      </article>
    ),
    funnel: (
      <article className="panel">
        <h2>{t("dash_funnel_title")}</h2>
        <div className="dash-funnel">
          {stats.funnel.map((stage, index) => (
            <Link
              key={stage.id}
              href={FUNNEL_STAGE_HREFS[stage.id]}
              className="dash-funnel-row dash-funnel-link"
            >
              <span className="dash-funnel-index">{index + 1}</span>
              <div className="dash-funnel-body">
                <div className="dash-funnel-label">
                  <strong>{t(FUNNEL_LABEL_KEYS[stage.id])}</strong>
                  <span>{stage.count}</span>
                </div>
                <div className="dist-track">
                  <div
                    className="dist-fill"
                    style={{ width: `${(stage.count / maxFunnel) * 100}%` }}
                  />
                </div>
              </div>
            </Link>
          ))}
          <div className="dash-funnel-extra">
            <Link href="/candidates?status=rejected" className="dash-meter">
              <span>{t("dash_funnel_rejected")}</span>
              <strong>{stats.hiringExtra.rejected}</strong>
            </Link>
            <Link href="/candidates?status=reserve" className="dash-meter">
              <span>{t("dash_funnel_reserve")}</span>
              <strong>{stats.hiringExtra.reserve}</strong>
            </Link>
          </div>
        </div>
      </article>
    ),
    trial: (
      <article className="panel">
        <h2>{t("dash_trial_block_title")}</h2>
        <div className="dash-meter-grid">
          <Meter
            label={t("dash_trial_active")}
            value={stats.trialBlock.active}
            href="/trial"
          />
          <Meter
            label={t("dash_trial_reports")}
            value={stats.trialBlock.reportsPending}
            href="/interns"
          />
          <Meter
            label={t("dash_trial_overdue")}
            value={stats.trialBlock.overdue}
            href="/interns"
          />
          <Meter
            label={t("dash_trial_ending")}
            value={stats.trialBlock.endingToday}
            href="/trial"
          />
          <Meter
            label={t("dash_trial_hired")}
            value={stats.trialBlock.hired}
            href="/trial"
          />
          <Meter
            label={t("dash_trial_rejected")}
            value={stats.trialBlock.rejected}
            href="/trial"
          />
        </div>
        <div className="dash-day-bars" style={{ marginTop: 12 }}>
          {stats.trialBlock.byDay.map((row) => (
            <div key={row.day} className="dash-day-bar">
              <span>
                {t("dash_trial_day")} {row.day}
              </span>
              <div className="dist-track">
                <div
                  className="dist-fill"
                  style={{
                    width: `${Math.min(100, row.count * 20)}%`,
                  }}
                />
              </div>
              <strong>{row.count}</strong>
            </div>
          ))}
        </div>
      </article>
    ),
    learning: (
      <article className="panel">
        <h2>{t("dash_learning_block_title")}</h2>
        <div className="dash-meter-grid">
          <Meter
            label={t("dash_learn_on")}
            value={stats.learningBlock.onLearning}
            href="/learning"
          />
          <Meter
            label="0–25%"
            value={stats.learningBlock.bucket025}
            href="/learning?focus=overdue"
          />
          <Meter
            label="26–50%"
            value={stats.learningBlock.bucket2650}
            href="/learning"
          />
          <Meter
            label="51–75%"
            value={stats.learningBlock.bucket5175}
            href="/learning"
          />
          <Meter
            label="76–99%"
            value={stats.learningBlock.bucket7699}
            href="/learning"
          />
          <Meter
            label={t("dash_learn_ready")}
            value={stats.learningBlock.readyAttestation}
            href="/attestation"
          />
          <Meter
            label={t("dash_learn_middle")}
            value={stats.learningBlock.middle}
            href="/employees"
          />
          <Meter
            label={t("dash_learn_lagging")}
            value={stats.learningBlock.lagging}
            href="/learning?focus=overdue"
          />
          <Meter
            label={t("dash_learn_no_program")}
            value={stats.learningBlock.noProgram}
            href="/learning"
          />
        </div>
      </article>
    ),
    events: (
      <article className="panel">
        <div className="dash-events-head">
          <h2>{t("dash_events_title")}</h2>
          <div className="dash-action-btns">
            {(["day", "week", "month"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                className={
                  calendarMode === mode
                    ? "btn btn-primary dash-mini-btn"
                    : "btn btn-ghost dash-mini-btn"
                }
                onClick={() => setCalendarMode(mode)}
              >
                {t(
                  mode === "day"
                    ? "dash_cal_day"
                    : mode === "week"
                      ? "dash_cal_week"
                      : "dash_cal_month",
                )}
              </button>
            ))}
          </div>
        </div>
        {stats.events.length === 0 ? (
          <p className="muted">{t("dash_events_empty")}</p>
        ) : (
          <div className="list">
            {stats.events.map((event) => (
              <Link key={event.id} href={event.href} className="list-item">
                <div>
                  <strong>{event.title}</strong>
                  <div className="muted" style={{ fontSize: "0.85rem" }}>
                    {event.kind} ·{" "}
                    {new Date(event.when).toLocaleString(dateLocale, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </article>
    ),
    company: (
      <article className="panel">
        <h2>{t("dash_company_title")}</h2>
        <div className="dash-meter-grid">
          <Meter
            label={t("dash_company_conversion")}
            value={stats.companyMetrics.conversionHirePct}
            href="/reports/hiring"
          />
          <Meter
            label={t("dash_company_tests")}
            value={stats.companyMetrics.testPassPct}
            href="/reports/testing"
          />
          <Meter
            label={t("dash_company_trial")}
            value={stats.companyMetrics.trialHirePct}
            href="/reports/trial"
          />
          <Meter
            label={t("dash_company_overdue")}
            value={stats.companyMetrics.overdueTasks}
            href="/learning?focus=overdue"
          />
        </div>
      </article>
    ),
    integrations: (
      <article className="panel">
        <h2>{t("dash_integrations_title")}</h2>
        <div className="dash-int-grid">
          {stats.integrations.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`dash-int-card dash-int-${item.status}`}
            >
              <strong>{t(item.labelKey)}</strong>
              <span>
                {item.status === "ok"
                  ? t("dash_int_ok")
                  : item.status === "error"
                    ? t("dash_int_error")
                    : t("dash_int_unset")}
              </span>
            </Link>
          ))}
        </div>
      </article>
    ),
  };

  return (
    <AppShell pathname="/">
      {permanentDocument ? (
        <DeferredCanvas
          document={permanentDocument}
          className="role-home-live intern-permanent-welcome"
        />
      ) : null}
      <PageHeader
        title={t("overview_title")}
        subtitle={t("overview_subtitle")}
        action={
          customize ? (
            <Link href="/" className="btn">
              {t("dash_customize_done")}
            </Link>
          ) : (
            <Link href="/?customize=1" className="btn btn-ghost">
              {t("admin_desk_customize")}
            </Link>
          )
        }
      />

      {customize ? (
        <section className="panel dash-customize" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>{t("dash_customize_title")}</h2>
          <p className="muted">{t("dash_customize_note")}</p>
          <div className="dash-preset-row">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="btn btn-ghost"
                onClick={() => saveLayout(preset.blocks)}
              >
                {t(preset.labelKey)}
              </button>
            ))}
            <button
              type="button"
              className="btn"
              onClick={() => saveLayout(DEFAULT_LAYOUT)}
            >
              {t("dash_customize_reset")}
            </button>
          </div>
          <div className="dash-customize-list">
            {BLOCK_KEYS.map((id) => {
              const on = layout.includes(id);
              return (
                <div key={id} className="dash-customize-item">
                  <label className="cand-check">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleBlock(id)}
                    />
                    {t(BLOCK_TITLES[id])}
                  </label>
                  {on ? (
                    <span className="dash-action-btns">
                      <button
                        type="button"
                        className="btn btn-ghost dash-mini-btn"
                        onClick={() => moveBlock(id, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost dash-mini-btn"
                        onClick={() => moveBlock(id, 1)}
                      >
                        ↓
                      </button>
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="dash-desk-stack">
        {visible.map((id) =>
          customize && !layout.includes(id) ? null : (
            <div key={id} className="dash-desk-block">
              {blocks[id]}
            </div>
          ),
        )}
      </div>
    </AppShell>
  );
}
