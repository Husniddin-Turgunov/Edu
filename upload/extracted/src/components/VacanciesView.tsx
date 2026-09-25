"use client";

import { AppShell, PageHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";

type Vacancy = {
  id: number;
  code: string;
  roleTitle: string;
  department: string;
  status: string;
};

export function VacanciesView({ list }: { list: Vacancy[] }) {
  const { t, locale } = useI18n();

  return (
    <AppShell pathname="/vacancies">
      <PageHeader
        title={t("vacancies_title")}
        subtitle={t("vacancies_subtitle")}
      />

      <section className="panel table-wrap">
        <h2>
          {t("vacancies_title")} · {list.length}
        </h2>
        {list.length === 0 ? (
          <p className="muted">{t("no_vacancies")}</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>{t("col_code")}</th>
                <th>{t("col_position")}</th>
                <th>{t("col_department")}</th>
                <th>{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((v) => (
                <tr key={v.id}>
                  <td className="muted">{v.code || "—"}</td>
                  <td>
                    <strong>
                      {localizeStaffText(v.roleTitle, locale, "role")}
                    </strong>
                  </td>
                  <td>
                    {localizeStaffText(v.department, locale, "department")}
                  </td>
                  <td>
                    <span className="level-badge level-unassessed">
                      {t("vacancy_open")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AppShell>
  );
}
