"use client";

import { AppShell, LevelBadge, PageHeader } from "@/components/ui";
import {
  approvePromotionAction,
  rejectPromotionAction,
} from "@/db/actions";
import { useI18n } from "@/lib/i18n";
import { levelLabel } from "@/lib/levels";
import { localizeStaffText } from "@/lib/staff-localization";

type RequestRow = {
  id: number;
  employeeName: string;
  roleTitle: string;
  department: string;
  fromLevel: string;
  toLevel: string;
  score: number;
  createdAt: string;
};

export function ManagerApprovalsView({
  department,
  requests,
  themeHue,
}: {
  department: string;
  requests: RequestRow[];
  themeHue: number;
}) {
  const { t, locale } = useI18n();
  const dateLocale =
    locale === "uz" ? "uz-UZ" : locale === "en" ? "en-GB" : "ru-RU";

  return (
    <AppShell pathname="/observer/approvals" role="manager" themeHue={themeHue}>
      <PageHeader
        title={t("nav_approvals")}
        subtitle={
          department
            ? localizeStaffText(department, locale, "department")
            : t("promo_need_department")
        }
      />

      {!department ? (
        <section className="panel">
          <p className="lead">{t("promo_need_department")}</p>
        </section>
      ) : requests.length === 0 ? (
        <section className="panel">
          <p className="lead">{t("promo_empty")}</p>
        </section>
      ) : (
        <section className="stack" style={{ gap: 14, maxWidth: 820 }}>
          {requests.map((row) => (
            <article key={row.id} className="panel">
              <p className="eyebrow">
                {new Date(row.createdAt).toLocaleString(dateLocale, {
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <h2>{localizeStaffText(row.employeeName, locale, "name")}</h2>
              <p className="muted">
                {localizeStaffText(row.roleTitle, locale, "role")} ·{" "}
                {localizeStaffText(row.department, locale, "department")}
              </p>
              <p style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <LevelBadge level={row.fromLevel} />
                <span>→</span>
                <LevelBadge level={row.toLevel} />
                <span className="muted">
                  {levelLabel(row.fromLevel)} → {levelLabel(row.toLevel)} ·{" "}
                  {Math.round(row.score)}%
                </span>
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                <form action={approvePromotionAction}>
                  <input type="hidden" name="requestId" value={row.id} />
                  <button type="submit" className="btn btn-primary">
                    {t("promo_approve")}
                  </button>
                </form>
                <form action={rejectPromotionAction}>
                  <input type="hidden" name="requestId" value={row.id} />
                  <button type="submit" className="btn">
                    {t("promo_reject")}
                  </button>
                </form>
              </div>
            </article>
          ))}
        </section>
      )}
    </AppShell>
  );
}
