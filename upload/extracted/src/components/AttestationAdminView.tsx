"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppShell, PageHeader } from "@/components/ui";
import {
  createAttestationAction,
  syncDriveAttestationsAction,
} from "@/db/actions";
import { useI18n } from "@/lib/i18n";

type StaffRole = { id: string; label: string; department: string };
type AttestationRow = {
  id: number;
  title: string;
  description: string;
  department: string;
  positionTitles: string[];
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  passingScore: number;
  isActive: boolean;
  questionCount: number;
  usesLibraryTest: boolean;
  libraryTestTitle: string | null;
  windowStatus: "upcoming" | "open" | "closed";
};
type LibraryTest = { id: number; title: string };

function toLocalInputValue(from = new Date(), plusDays = 0) {
  const d = new Date(from.getTime() + plusDays * 86400000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatRange(startsAt: string, endsAt: string, locale: string) {
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(dateLocale, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  return `${fmt(startsAt)} — ${fmt(endsAt)}`;
}

export function AttestationAdminView({
  attestations,
  staffRoles,
  libraryTests,
  driveConfigured = false,
}: {
  attestations: AttestationRow[];
  staffRoles: StaffRole[];
  libraryTests: LibraryTest[];
  driveConfigured?: boolean;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | AttestationRow["windowStatus"] | "draft"
  >("all");
  const [openDept, setOpenDept] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [syncNote, setSyncNote] = useState("");

  const filteredRoles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staffRoles;
    return staffRoles.filter(
      (role) =>
        role.label.toLowerCase().includes(q) ||
        role.department.toLowerCase().includes(q),
    );
  }, [query, staffRoles]);

  const rolesByDepartment = useMemo(() => {
    const grouped = new Map<string, StaffRole[]>();
    for (const role of filteredRoles) {
      const rows = grouped.get(role.department) ?? [];
      rows.push(role);
      grouped.set(role.department, rows);
    }
    return [...grouped.entries()];
  }, [filteredRoles]);

  const filteredAttestations = useMemo(() => {
    return attestations.filter((row) => {
      if (statusFilter === "draft") return !row.isActive;
      if (statusFilter !== "all" && row.isActive) {
        return row.windowStatus === statusFilter;
      }
      if (statusFilter !== "all" && !row.isActive) return false;
      return true;
    });
  }, [attestations, statusFilter]);

  const unassigned = filteredAttestations.filter((row) => !row.department.trim());
  const createRoles = staffRoles.filter((role) => role.department === openDept);

  function countForDept(department: string) {
    return filteredAttestations.filter((row) => row.department === department)
      .length;
  }

  function statusLabel(status: AttestationRow["windowStatus"]) {
    if (status === "open") return t("attest_open");
    if (status === "upcoming") return t("attest_upcoming");
    return t("attest_closed");
  }

  return (
    <AppShell pathname="/attestation">
      <PageHeader
        title={t("admin_attest_title")}
        subtitle={t("admin_attest_note")}
      />

      <section className="stack" style={{ gap: 18, maxWidth: 980 }}>
        <article className="panel">
          <h2>{t("admin_attest_drive_title")}</h2>
          <p className="muted">
            {driveConfigured
              ? t("admin_attest_drive_ok")
              : t("drive_sync_off")}
          </p>
          {syncNote ? <p className="muted">{syncNote}</p> : null}
          <button
            type="button"
            className="btn btn-primary"
            disabled={!driveConfigured || pending}
            onClick={() => {
              startTransition(async () => {
                const summary = await syncDriveAttestationsAction();
                setSyncNote(summary.message);
                router.refresh();
              });
            }}
          >
            {pending ? t("drive_syncing") : t("drive_sync_now")}
          </button>
        </article>

        <article className="panel">
          <div className="layout-2" style={{ gap: 12 }}>
            <label>
              {t("admin_learning_search_role")}
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("admin_learning_search_placeholder")}
              />
            </label>
            <label>
              {t("admin_attest_filter_status")}
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as typeof statusFilter,
                  )
                }
              >
                <option value="all">{t("admin_attest_filter_all")}</option>
                <option value="open">{t("attest_open")}</option>
                <option value="upcoming">{t("attest_upcoming")}</option>
                <option value="closed">{t("attest_closed")}</option>
                <option value="draft">{t("admin_attest_draft")}</option>
              </select>
            </label>
          </div>
        </article>

        {unassigned.length > 0 ? (
          <article className="panel">
            <h2>{t("admin_attest_unassigned")}</h2>
            <div className="list" style={{ marginTop: 10 }}>
              {unassigned.map((row) => (
                <Link
                  key={row.id}
                  href={`/attestation/${row.id}`}
                  className="list-item learn-role-card"
                >
                  <span style={{ flex: 1, textAlign: "left" }}>
                    <strong>{row.title}</strong>
                    <div className="muted">
                      {formatRange(row.startsAt, row.endsAt, locale)} ·{" "}
                      {t("admin_attest_questions").replace(
                        "{n}",
                        String(row.questionCount),
                      )}
                    </div>
                  </span>
                  <span className="muted">{statusLabel(row.windowStatus)}</span>
                </Link>
              ))}
            </div>
          </article>
        ) : null}

        {rolesByDepartment.map(([department, roles]) => {
          const deptOpen = openDept === department;
          const rows = filteredAttestations.filter(
            (item) => item.department === department,
          );
          return (
            <article key={department} className="panel">
              <button
                type="button"
                className="learn-role-toggle"
                onClick={() => {
                  setOpenDept((prev) => (prev === department ? null : department));
                  setCreating(false);
                }}
              >
                <span>
                  <strong>{department}</strong>
                  <span className="muted" style={{ marginLeft: 8 }}>
                    {t("admin_attest_dept_count")
                      .replace("{roles}", String(roles.length))
                      .replace("{n}", String(countForDept(department)))}
                  </span>
                </span>
                <span className="muted">{deptOpen ? "▾" : "▸"}</span>
              </button>

              {deptOpen ? (
                <>
                  <div className="list" style={{ marginTop: 12 }}>
                    {rows.length === 0 ? (
                      <p className="muted">{t("admin_attest_empty_dept")}</p>
                    ) : (
                      rows.map((row) => (
                        <Link
                          key={row.id}
                          href={`/attestation/${row.id}`}
                          className="list-item learn-role-card"
                        >
                          <span style={{ flex: 1, textAlign: "left" }}>
                            <strong>{row.title}</strong>
                            <div className="muted">
                              {formatRange(row.startsAt, row.endsAt, locale)} ·{" "}
                              {t("admin_attest_questions").replace(
                                "{n}",
                                String(row.questionCount),
                              )}{" "}
                              · {row.positionTitles.length}{" "}
                              {t("admin_attest_positions_short")}
                              {row.usesLibraryTest && row.libraryTestTitle
                                ? ` · ${t("admin_attest_linked")}: ${row.libraryTestTitle}`
                                : ""}
                            </div>
                          </span>
                          <span className="muted">
                            {row.isActive
                              ? statusLabel(row.windowStatus)
                              : t("admin_attest_draft")}
                          </span>
                        </Link>
                      ))
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ marginTop: 12 }}
                    onClick={() => setCreating((prev) => !prev)}
                  >
                    {t("admin_attest_create")}
                  </button>
                  {creating ? (
                    <form
                      className="stack-form"
                      style={{ marginTop: 14 }}
                      action={(fd) => {
                        startTransition(async () => {
                          await createAttestationAction(fd);
                          router.refresh();
                        });
                      }}
                    >
                      <input type="hidden" name="department" value={department} />
                      <input type="hidden" name="isActive" value="on" />
                      <label>
                        {t("admin_field_title")}
                        <input name="title" required defaultValue="" />
                      </label>
                      <label>
                        {t("test_description")}
                        <textarea name="description" rows={2} />
                      </label>
                      <div className="layout-2" style={{ gap: 12 }}>
                        <label>
                          {t("admin_attest_starts")}
                          <input
                            name="startsAt"
                            type="datetime-local"
                            defaultValue={toLocalInputValue()}
                            required
                          />
                        </label>
                        <label>
                          {t("admin_attest_ends")}
                          <input
                            name="endsAt"
                            type="datetime-local"
                            defaultValue={toLocalInputValue(new Date(), 14)}
                            required
                          />
                        </label>
                      </div>
                      <div className="layout-2" style={{ gap: 12 }}>
                        <label>
                          {t("admin_attest_duration")}
                          <input
                            name="durationMinutes"
                            type="number"
                            min={5}
                            defaultValue={40}
                          />
                        </label>
                        <label>
                          {t("admin_attest_pass")}
                          <input
                            name="passingScore"
                            type="number"
                            min={1}
                            max={100}
                            defaultValue={70}
                          />
                        </label>
                      </div>
                      <label>
                        {t("admin_attest_source")}
                        <select name="libraryAssessmentId" defaultValue="">
                          <option value="">{t("admin_attest_own_questions")}</option>
                          {libraryTests.map((test) => (
                            <option key={test.id} value={test.id}>
                              {test.title}
                            </option>
                          ))}
                        </select>
                      </label>
                      <fieldset className="attest-positions">
                        <legend>{t("admin_attest_positions")}</legend>
                        <p className="muted">{t("admin_attest_positions_hint")}</p>
                        {createRoles.map((role) => (
                          <label key={role.id} className="attest-position-item">
                            <input
                              type="checkbox"
                              name="positionTitle"
                              value={role.id}
                              defaultChecked
                            />
                            <span>{role.label}</span>
                          </label>
                        ))}
                      </fieldset>
                      <button
                        className="btn btn-primary"
                        type="submit"
                        disabled={pending}
                      >
                        {t("admin_learning_save")}
                      </button>
                    </form>
                  ) : null}
                </>
              ) : null}
            </article>
          );
        })}
      </section>
    </AppShell>
  );
}
