"use client";

import Link from "next/link";
import { ExpandOnClick } from "@/components/ExpandOnClick";
import { AppShell, LevelBadge, PageHeader } from "@/components/ui";
import { startAttestationAction } from "@/db/actions";
import type { EmployeeAttestationPage } from "@/db/employee-home";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { levelLabel } from "@/lib/levels";
import { localizeStaffText } from "@/lib/staff-localization";

function attestationTypeKey(type: string) {
  const map: Record<string, string> = {
    after_trial: "attest_type_after_trial",
    month_1: "attest_type_month_1",
    month_2: "attest_type_month_2",
    final_3_months: "attest_type_final_3_months",
    repeat: "attest_type_repeat",
    annual: "attest_type_annual",
    transfer: "attest_type_transfer",
  };
  return map[type] ?? "attest_type_final_3_months";
}

const decisionKeys: Record<string, string> = {
  middle_confirmed: "attest_decision_middle_confirmed",
  middle_not_confirmed: "attest_decision_middle_not_confirmed",
  keep_junior: "attest_decision_keep_junior",
  additional_learning: "attest_decision_additional_learning",
  repeat: "attest_decision_repeat",
  transfer: "attest_decision_transfer",
};

const reviewStatusKeys: Record<string, MessageKey> = {
  scheduled: "eh_attest_review_scheduled",
  in_progress: "eh_attest_review_progress",
  awaiting_commission: "eh_attest_review_commission",
  completed: "eh_attest_review_done",
};

function formatWhen(iso: string, locale: string) {
  const date = new Date(iso);
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  return date.toLocaleString(dateLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string, locale: string) {
  const date = new Date(iso);
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";
  return date.toLocaleDateString(dateLocale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function windowStatusClass(status: "upcoming" | "open" | "closed") {
  if (status === "open") return "learn-status-open";
  if (status === "upcoming") return "learn-status-soon";
  return "learn-status-not_started";
}

function itemStatusKey(item: EmployeeAttestationPage["items"][number]) {
  if (item.result) {
    return item.passed ? "eh_attest_status_passed" : "eh_attest_status_failed";
  }
  if (item.canStart) return "eh_attest_status_ready";
  if (item.windowStatus === "upcoming") return "attest_upcoming";
  if (item.windowStatus === "open") return "eh_attest_status_waiting";
  return "attest_closed";
}

function itemStatusClass(item: EmployeeAttestationPage["items"][number]) {
  if (item.result) {
    return item.passed ? "learn-status-credited" : "learn-status-overdue";
  }
  if (item.canStart) return "learn-status-accepted";
  return windowStatusClass(item.windowStatus);
}

function AttestationCard({
  item,
  locale,
  displayRole,
  t,
}: {
  item: EmployeeAttestationPage["items"][number];
  locale: string;
  displayRole: string;
  t: (key: MessageKey) => string;
}) {
  const locked = !item.canStart && !item.result;

  return (
    <article className="panel attest-card">
      <div className="learn-pill-row">
        <span className={`learn-status ${itemStatusClass(item)}`}>
          {t(itemStatusKey(item) as MessageKey)}
        </span>
        <span className="learn-meta-chip">
          {t("attest_duration_line").replace("{n}", String(item.durationMinutes))}
        </span>
        <span className="learn-meta-chip">
          {t("attest_pass_line").replace("{n}", String(item.passingScore))}
        </span>
      </div>
      <h2>{item.title}</h2>
      {item.description ? <p className="lead">{item.description}</p> : null}
      <p className="muted">
        {t("attest_window")
          .replace("{start}", formatWhen(item.startsAt, locale))
          .replace("{end}", formatWhen(item.endsAt, locale))}
      </p>

      {item.result ? (
        <div className="attest-result-row">
          <strong>
            {item.passed ? t("attest_passed") : t("attest_failed")}:{" "}
            {Math.round(item.result.score)}%
          </strong>
          <span className="muted">
            {formatWhen(item.result.completedAt, locale)}
          </span>
        </div>
      ) : item.canStart ? (
        <form action={startAttestationAction} className="attest-start-form">
          <input type="hidden" name="attestationId" value={item.id} />
          <button type="submit" className="btn btn-primary">
            {t("attest_start")}
          </button>
        </form>
      ) : (
        <article
          className="list-item learn-lesson-card learn-lesson-card-locked attest-locked-card"
          tabIndex={0}
        >
          <div className="learn-lesson-content" style={{ flex: 1 }}>
            <strong>{item.title}</strong>
            <div className="muted">
              {displayRole} · {formatWhen(item.startsAt, locale)}
            </div>
            <p style={{ margin: "8px 0 0" }}>
              {item.questionCount < 1
                ? t("attest_waiting_test")
                : item.windowStatus === "upcoming"
                  ? t("attest_blur_note")
                  : t("attest_closed_heading")}
            </p>
          </div>
          {locked ? (
            <div className="learn-lock-overlay" aria-hidden="true">
              <span className="learn-lock-icon">🔒</span>
              <strong>{t("learn_locked")}</strong>
            </div>
          ) : null}
        </article>
      )}
    </article>
  );
}

function ReviewCard({
  review,
  locale,
  t,
}: {
  review: EmployeeAttestationPage["reviews"][number];
  locale: string;
  t: (key: MessageKey) => string;
}) {
  const statusKey = reviewStatusKeys[review.status] ?? "eh_attest_review_scheduled";
  const comments = [
    { label: t("eh_attest_comment_mentor"), text: review.mentorComment },
    { label: t("eh_attest_comment_manager"), text: review.managerComment },
    { label: t("eh_attest_comment_commission"), text: review.commissionComment },
  ].filter((row) => row.text.trim());

  return (
    <article className="list-item learn-role-card attest-review-card">
      <div className="attest-review-head">
        <div>
          <strong>{review.attestationTitle}</strong>
          <span className="muted" style={{ display: "block" }}>
            {t(attestationTypeKey(review.type) as MessageKey)} ·{" "}
            {formatWhen(review.scheduledAt, locale)}
          </span>
        </div>
        <span className={`learn-status ${review.status === "completed" ? "learn-status-credited" : "learn-status-submitted"}`}>
          {t(statusKey)}
        </span>
      </div>

      {review.status === "completed" && review.decision ? (
        <p className="attest-decision-line">
          {t("attest_review_decision")}:{" "}
          {decisionKeys[review.decision]
            ? t(decisionKeys[review.decision] as MessageKey)
            : review.decision}
          {review.finalScore != null
            ? ` · ${t("attest_review_score")}: ${Math.round(review.finalScore)}%`
            : ""}
          {review.testScore != null
            ? ` · ${t("eh_attest_test_score")}: ${Math.round(review.testScore)}%`
            : ""}
        </p>
      ) : null}

      {review.nextCheckAt ? (
        <p className="muted">
          {t("eh_attest_next_check").replace(
            "{date}",
            formatDate(review.nextCheckAt, locale),
          )}
        </p>
      ) : null}

      {review.weakCompetencies.length > 0 ? (
        <div className="attest-weak-list">
          <span className="eyebrow">{t("eh_attest_weak_title")}</span>
          <ul>
            {review.weakCompetencies.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {comments.length > 0 ? (
        <ExpandOnClick
          hint={t("eh_attest_comments_hint")}
          action={t("eh_attest_comments_show")}
        >
          <div className="attest-comments">
            {comments.map((row) => (
              <div key={row.label} className="attest-comment">
                <span className="eyebrow">{row.label}</span>
                <p>{row.text}</p>
              </div>
            ))}
          </div>
        </ExpandOnClick>
      ) : null}

      {review.protocolNumber ? (
        <a
          href={`/api/attestation-protocol/${review.id}`}
          className="btn btn-ghost"
        >
          {t("attest_review_protocol")}
        </a>
      ) : null}
    </article>
  );
}

export function ParticipantAttestationView({
  data,
  themeHue,
}: {
  data: EmployeeAttestationPage;
  themeHue: number;
}) {
  const { t, locale } = useI18n();
  const displayName = localizeStaffText(data.person.name, locale, "name");
  const displayRole = localizeStaffText(data.person.roleTitle, locale, "role");
  const displayDept = localizeStaffText(
    data.person.department,
    locale,
    "department",
  );
  const targetLevel = data.person.targetLevel || "middle";

  const openItems = data.items.filter(
    (row) => row.windowStatus === "open" && !row.result,
  );
  const upcomingItems = data.items.filter(
    (row) => row.windowStatus === "upcoming",
  );
  const historyItems = data.items.filter((row) => row.result != null);
  const latestCompleted = data.reviews.find(
    (row) => row.status === "completed" && row.decision,
  );

  return (
    <AppShell pathname="/my/attestation" role="employee" themeHue={themeHue}>
      <PageHeader
        title={t("nav_my_attestations")}
        subtitle={t("eh_attest_note")}
        action={
          data.nextOpen?.canStart ? (
            <form action={startAttestationAction}>
              <input
                type="hidden"
                name="attestationId"
                value={data.nextOpen.id}
              />
              <button type="submit" className="btn btn-primary">
                {t("attest_start")}
              </button>
            </form>
          ) : data.kpis.open > 0 ? (
            <Link href="#attest-open" className="btn btn-primary">
              {t("eh_attest_open_now")}
            </Link>
          ) : (
            <Link href="/my/statistics" className="btn btn-ghost">
              {t("nav_my_progress")}
            </Link>
          )
        }
      />

      <section className="dash-kpi-grid dash-kpi-grid-attest">
        <div className="stat">
          <span>{t("eh_attest_kpi_open")}</span>
          <strong>{data.kpis.open}</strong>
        </div>
        <div className="stat">
          <span>{t("eh_attest_kpi_upcoming")}</span>
          <strong>{data.kpis.upcoming}</strong>
        </div>
        <div className="stat">
          <span>{t("eh_attest_kpi_completed")}</span>
          <strong>{data.kpis.completed}</strong>
        </div>
        <div className={`stat${data.kpis.passed > 0 ? "" : ""}`}>
          <span>{t("eh_attest_kpi_passed")}</span>
          <strong>{data.kpis.passed}</strong>
        </div>
      </section>

      <section className="panel attest-level-card">
        <div className="attest-level-head">
          <div>
            <p className="eyebrow">{t("eh_attest_level_title")}</p>
            <h2 style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <LevelBadge level={data.person.currentLevel} />
              <span>
                {levelLabel(
                  data.person.currentLevel === "unassessed"
                    ? "junior"
                    : data.person.currentLevel,
                )}
              </span>
            </h2>
            <p className="muted">
              {displayName} · {displayRole} · {displayDept}
            </p>
            <p className="muted">
              {t("eh_attest_target").replace(
                "{level}",
                levelLabel(targetLevel),
              )}
            </p>
          </div>
          {data.promotion ? (
            <div className="attest-promo-box">
              <span className="eyebrow">{t("eh_attest_promo_title")}</span>
              <strong>
                {data.promotion.status === "pending"
                  ? t("promo_pending")
                  : data.promotion.status === "approved"
                    ? t("promo_approved")
                    : t("promo_rejected")}
              </strong>
              <p className="muted">
                {levelLabel(data.promotion.fromLevel)} →{" "}
                {levelLabel(data.promotion.toLevel)} ·{" "}
                {Math.round(data.promotion.score)}%
              </p>
              {data.promotion.status === "pending" ? (
                <p className="muted">{t("promo_pending_note")}</p>
              ) : null}
            </div>
          ) : null}
        </div>
        {data.kpis.awaitingCommission > 0 ? (
          <p className="attest-commission-note">
            {t("eh_attest_commission_wait").replace(
              "{n}",
              String(data.kpis.awaitingCommission),
            )}
          </p>
        ) : null}
      </section>

      {data.nextOpen ? (
        <section className="panel learn-resume attest-resume">
          <p className="eyebrow">{t("eh_attest_resume_title")}</p>
          <h2>{data.nextOpen.title}</h2>
          <div className="learn-pill-row">
            <span
              className={`learn-status ${itemStatusClass(data.nextOpen)}`}
            >
              {t(itemStatusKey(data.nextOpen) as MessageKey)}
            </span>
            <span className="learn-meta-chip">
              {formatWhen(data.nextOpen.startsAt, locale)} —{" "}
              {formatWhen(data.nextOpen.endsAt, locale)}
            </span>
          </div>
          {data.nextOpen.canStart ? (
            <form action={startAttestationAction} className="attest-start-form">
              <input
                type="hidden"
                name="attestationId"
                value={data.nextOpen.id}
              />
              <button type="submit" className="btn btn-primary">
                {t("attest_start")}
              </button>
            </form>
          ) : (
            <p className="muted">{t("eh_attest_resume_wait")}</p>
          )}
        </section>
      ) : null}

      {openItems.length > 0 ? (
        <section id="attest-open" className="attest-section">
          <h2 className="dash-section-title">{t("eh_attest_open_title")}</h2>
          <div className="stack attest-stack">
            {openItems.map((item) => (
              <AttestationCard
                key={item.id}
                item={item}
                locale={locale}
                displayRole={displayRole}
                t={t}
              />
            ))}
          </div>
        </section>
      ) : null}

      {upcomingItems.length > 0 ? (
        <section className="attest-section">
          <h2 className="dash-section-title">{t("eh_attest_upcoming_title")}</h2>
          <ExpandOnClick
            hint={t("eh_attest_list_hint")}
            action={t("eh_attest_upcoming_show")}
          >
            <div className="stack attest-stack">
              {upcomingItems.map((item) => (
                <AttestationCard
                  key={item.id}
                  item={item}
                  locale={locale}
                  displayRole={displayRole}
                  t={t}
                />
              ))}
            </div>
          </ExpandOnClick>
        </section>
      ) : null}

      {historyItems.length > 0 ? (
        <section className="attest-section">
          <h2 className="dash-section-title">{t("eh_attest_history_title")}</h2>
          <ExpandOnClick
            hint={t("eh_attest_list_hint")}
            action={t("eh_attest_history_show")}
          >
            <div className="stack attest-stack">
              {historyItems.map((item) => (
                <AttestationCard
                  key={item.id}
                  item={item}
                  locale={locale}
                  displayRole={displayRole}
                  t={t}
                />
              ))}
            </div>
          </ExpandOnClick>
        </section>
      ) : null}

      {data.reviews.length > 0 ? (
        <section className="panel attest-section">
          <h2>{t("attest_reviews_title")}</h2>
          <p className="muted">{t("eh_attest_reviews_note")}</p>
          <div className="list" style={{ marginTop: 12 }}>
            {data.reviews.map((review) => (
              <ReviewCard key={review.id} review={review} locale={locale} t={t} />
            ))}
          </div>
        </section>
      ) : null}

      {latestCompleted || data.recommendations.length > 0 ? (
        <section className="panel attest-section">
          <h2>{t("eh_attest_recommend_title")}</h2>
          <p className="muted">{t("eh_attest_recommend_note")}</p>
          {latestCompleted?.decision ? (
            <p className="attest-decision-line">
              {decisionKeys[latestCompleted.decision]
                ? t(decisionKeys[latestCompleted.decision] as MessageKey)
                : latestCompleted.decision}
            </p>
          ) : null}
          {data.recommendations.length > 0 ? (
            <ExpandOnClick
              hint={t("eh_attest_list_hint")}
              action={t("eh_attest_recommend_show")}
            >
              <ul className="attest-recommend-list">
                {data.recommendations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </ExpandOnClick>
          ) : (
            <p className="muted">{t("eh_attest_recommend_empty")}</p>
          )}
        </section>
      ) : null}

      {data.items.length === 0 && data.reviews.length === 0 ? (
        <section className="panel">
          <p className="lead">{t("attest_empty")}</p>
          <p className="muted">{t("eh_attest_empty_note")}</p>
        </section>
      ) : null}
    </AppShell>
  );
}
