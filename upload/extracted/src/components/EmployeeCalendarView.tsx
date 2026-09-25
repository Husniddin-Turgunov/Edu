"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExpandOnClick } from "@/components/ExpandOnClick";
import { AppShell, PageHeader } from "@/components/ui";
import type {
  EmployeeCalendarEvent,
  EmployeeCalendarKind,
  EmployeeCalendarPage,
} from "@/db/employee-home";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useImportedContent } from "@/lib/imported-content-i18n";

const KIND_KEYS: Record<EmployeeCalendarKind, MessageKey> = {
  lesson: "eh_task_kind_lesson",
  test: "eh_task_kind_test",
  attestation: "eh_task_kind_attest",
};

const WEEKDAY_KEYS: MessageKey[] = [
  "eh_cal_mon",
  "eh_cal_tue",
  "eh_cal_wed",
  "eh_cal_thu",
  "eh_cal_fri",
  "eh_cal_sat",
  "eh_cal_sun",
];

type KindFilter = "all" | EmployeeCalendarKind;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function ymdFromParts(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function weekdayFromYmd(ymd: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

function mondayOffset(year: number, month: number) {
  const day = weekdayFromYmd(ymdFromParts(year, month, 1));
  return day === 0 ? 6 : day - 1;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function workDayNumbers(workDays: string) {
  const lower = workDays.trim().toLowerCase();
  if (lower === "mon-sat" || lower === "пн-сб") {
    return new Set([1, 2, 3, 4, 5, 6]);
  }
  if (lower === "mon-sun" || lower === "every" || lower === "ежедневно") {
    return new Set([0, 1, 2, 3, 4, 5, 6]);
  }
  return new Set([1, 2, 3, 4, 5]);
}

function formatWhen(iso: string, locale: string, timeZone: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  return date.toLocaleString(dateLocale, {
    timeZone,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDayTitle(ymd: string, locale: string, timeZone: string) {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (Number.isNaN(date.getTime())) return ymd;
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  return date.toLocaleDateString(dateLocale, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatMonthTitle(year: number, month: number, locale: string) {
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  return new Date(year, month, 1).toLocaleString(dateLocale, {
    month: "long",
    year: "numeric",
  });
}

function statusClass(event: EmployeeCalendarEvent) {
  if (event.overdue) return "learn-status-overdue";
  if (event.kind === "attestation") return "learn-status-accepted";
  if (event.kind === "test") return "learn-status-submitted";
  return "learn-status-soon";
}

function EventRow({
  event,
  locale,
  timeZone,
  title,
  t,
}: {
  event: EmployeeCalendarEvent;
  locale: string;
  timeZone: string;
  title: string;
  t: (key: MessageKey) => string;
}) {
  const when = formatWhen(event.at, locale, timeZone);
  const until = event.until ? formatWhen(event.until, locale, timeZone) : "";
  return (
    <Link href={event.href} className="list-item dash-action-link cal-event">
      <div style={{ flex: 1 }}>
        <div className="learn-pill-row">
          <span className={`learn-status ${statusClass(event)}`}>
            {t(KIND_KEYS[event.kind])}
          </span>
          <span className="learn-meta-chip">{t(event.statusKey)}</span>
        </div>
        <strong>{title}</strong>
        <div className="muted">
          {when}
          {until ? ` — ${until}` : ""}
        </div>
      </div>
    </Link>
  );
}

export function EmployeeCalendarView({
  data,
  themeHue,
}: {
  data: EmployeeCalendarPage;
  themeHue: number;
}) {
  const { t, locale } = useI18n();
  const localized = useImportedContent(
    data.events.map((event) => event.title),
    locale,
  );
  const [year, month] = data.today.split("-").map(Number);
  const [viewYear, setViewYear] = useState(year);
  const [viewMonth, setViewMonth] = useState(month - 1);
  const [selected, setSelected] = useState(data.today);
  const [filter, setFilter] = useState<KindFilter>("all");
  const workDays = workDayNumbers(data.company.workDays);

  const filtered = useMemo(
    () =>
      data.events.filter((event) =>
        filter === "all" ? true : event.kind === filter,
      ),
    [data.events, filter],
  );

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EmployeeCalendarEvent[]>();
    for (const event of filtered) {
      for (const day of event.days) {
        const list = map.get(day) ?? [];
        list.push(event);
        map.set(day, list);
      }
    }
    return map;
  }, [filtered]);

  const cells = useMemo(() => {
    const offset = mondayOffset(viewYear, viewMonth);
    const count = daysInMonth(viewYear, viewMonth);
    const items: { ymd: string; day: number; inMonth: boolean }[] = [];
    for (let i = 0; i < offset; i += 1) {
      items.push({ ymd: "", day: 0, inMonth: false });
    }
    for (let day = 1; day <= count; day += 1) {
      items.push({
        ymd: ymdFromParts(viewYear, viewMonth, day),
        day,
        inMonth: true,
      });
    }
    while (items.length % 7 !== 0) {
      items.push({ ymd: "", day: 0, inMonth: false });
    }
    return items;
  }, [viewYear, viewMonth]);

  const selectedEvents = selected ? (eventsByDay.get(selected) ?? []) : [];
  const upcoming = filtered.filter((event) =>
    event.days.some((day) => day >= data.today),
  );
  const nextEvent =
    filtered.find((event) => event.overdue) ??
    filtered.find((event) => event.days.includes(data.today)) ??
    upcoming[0] ??
    filtered[0] ??
    null;

  function shiftMonth(delta: number) {
    const date = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(date.getFullYear());
    setViewMonth(date.getMonth());
  }

  function goToday() {
    setViewYear(year);
    setViewMonth(month - 1);
    setSelected(data.today);
  }

  return (
    <AppShell pathname="/my/calendar" role="employee" themeHue={themeHue}>
      <PageHeader
        title={t("nav_my_calendar")}
        subtitle={t("eh_calendar_note")}
        action={
          nextEvent ? (
            <Link href={nextEvent.href} className="btn btn-primary">
              {t("eh_calendar_open")}
            </Link>
          ) : undefined
        }
      />

      <section className="dash-kpi-grid dash-kpi-grid-cal">
        <div className="stat">
          <span>{t("eh_calendar_kpi_today")}</span>
          <strong>{data.counts.today}</strong>
        </div>
        <div className="stat">
          <span>{t("eh_calendar_kpi_week")}</span>
          <strong>{data.counts.week}</strong>
        </div>
        <div className={`stat${data.counts.overdue ? " stat-warn" : ""}`}>
          <span>{t("eh_calendar_kpi_overdue")}</span>
          <strong>{data.counts.overdue}</strong>
        </div>
        <div className="stat">
          <span>{t("eh_calendar_kpi_attest")}</span>
          <strong>{data.counts.attestations}</strong>
        </div>
      </section>

      <section className="panel cal-hours">
        <p className="eyebrow">{t("eh_calendar_hours")}</p>
        <p>
          {t("eh_calendar_hours_line")
            .replace("{days}", data.company.workDays)
            .replace("{start}", data.company.workStart)
            .replace("{end}", data.company.workEnd)
            .replace("{tz}", data.company.timezone)}
        </p>
      </section>

      <div className="candidate-tabs" role="tablist" style={{ marginBottom: 14 }}>
        {(
          [
            ["all", "eh_task_filter_all"],
            ["lesson", "eh_calendar_filter_lesson"],
            ["test", "eh_calendar_filter_test"],
            ["attestation", "eh_calendar_filter_attest"],
          ] as const
        ).map(([id, key]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={filter === id ? "candidate-tab active" : "candidate-tab"}
            onClick={() => setFilter(id)}
          >
            {t(key)}
          </button>
        ))}
      </div>

      <section className="cal-layout">
        <article className="panel cal-month">
          <div className="cal-month-nav">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => shiftMonth(-1)}
              aria-label={t("eh_calendar_month_prev")}
            >
              ←
            </button>
            <strong>{formatMonthTitle(viewYear, viewMonth, locale)}</strong>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => shiftMonth(1)}
              aria-label={t("eh_calendar_month_next")}
            >
              →
            </button>
            <button type="button" className="btn btn-ghost" onClick={goToday}>
              {t("eh_calendar_today")}
            </button>
          </div>
          <div className="cal-weekdays">
            {WEEKDAY_KEYS.map((key) => (
              <span key={key}>{t(key)}</span>
            ))}
          </div>
          <div className="cal-grid">
            {cells.map((cell, index) => {
              if (!cell.inMonth) {
                return <div key={`empty-${index}`} className="cal-cell is-empty" />;
              }
              const dayEvents = eventsByDay.get(cell.ymd) ?? [];
              const weekday = weekdayFromYmd(cell.ymd);
              const isToday = cell.ymd === data.today;
              const isSelected = cell.ymd === selected;
              const off = !workDays.has(weekday);
              return (
                <button
                  key={cell.ymd}
                  type="button"
                  className={[
                    "cal-cell",
                    isToday ? "is-today" : "",
                    isSelected ? "is-selected" : "",
                    off ? "is-off" : "",
                    dayEvents.length ? "has-events" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setSelected(cell.ymd)}
                >
                  <span className="cal-cell-num">{cell.day}</span>
                  {dayEvents.length > 0 ? (
                    <span className="cal-dots">
                      {dayEvents.slice(0, 3).map((event) => (
                        <span
                          key={event.id}
                          className={`cal-dot cal-dot-${event.kind}${event.overdue ? " is-overdue" : ""}`}
                        />
                      ))}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">{t("eh_calendar_agenda")}</p>
          <h2 style={{ marginTop: 4 }}>
            {selected
              ? formatDayTitle(selected, locale, data.company.timezone)
              : t("eh_calendar_today")}
          </h2>
          {selectedEvents.length === 0 ? (
            <p className="muted">{t("eh_calendar_day_empty")}</p>
          ) : (
            <div className="list">
              {selectedEvents.map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  locale={locale}
                  timeZone={data.company.timezone}
                  title={localized(event.title) || event.title}
                  t={t}
                />
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="panel cal-upcoming">
        <h2>{t("eh_calendar_upcoming")}</h2>
        {upcoming.length === 0 && filtered.filter((event) => event.overdue).length === 0 ? (
          <p className="muted">{t("eh_calendar_empty")}</p>
        ) : (
          <ExpandOnClick
            hint={t("eh_calendar_list_hint")}
            action={t("eh_calendar_list_show")}
          >
            <div className="list">
              {[
                ...filtered.filter((event) => event.overdue),
                ...upcoming.filter((event) => !event.overdue),
              ].map((event) => (
                <EventRow
                  key={event.id}
                  event={event}
                  locale={locale}
                  timeZone={data.company.timezone}
                  title={localized(event.title) || event.title}
                  t={t}
                />
              ))}
            </div>
          </ExpandOnClick>
        )}
      </section>
    </AppShell>
  );
}
