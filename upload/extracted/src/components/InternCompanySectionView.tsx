"use client";

import Link from "next/link";
import { ExpandOnClick } from "@/components/ExpandOnClick";
import { AppShell, PageHeader } from "@/components/ui";
import { DeferredCanvas } from "@/components/DeferredCanvas";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { localizeStaffText } from "@/lib/staff-localization";
import {
  DEFAULT_BACKGROUND,
  type RoleHomeDocument,
} from "@/lib/role-home";

export type InternCompanySection = "history" | "about" | "structure" | "rules";

const SECTION_KEYS: Record<
  InternCompanySection,
  { title: MessageKey; body: MessageKey; points: MessageKey[] }
> = {
  history: {
    title: "intern_intro_history_title",
    body: "intern_intro_history_body",
    points: [
      "intern_intro_history_point_1",
      "intern_intro_history_point_2",
      "intern_intro_history_point_3",
    ],
  },
  about: {
    title: "intern_intro_about_title",
    body: "intern_intro_about_body",
    points: [
      "intern_intro_about_point_1",
      "intern_intro_about_point_2",
      "intern_intro_about_point_3",
    ],
  },
  structure: {
    title: "intern_intro_structure_title",
    body: "intern_intro_structure_body",
    points: [
      "intern_intro_structure_point_1",
      "intern_intro_structure_point_2",
      "intern_intro_structure_point_3",
    ],
  },
  rules: {
    title: "intern_intro_rules_title",
    body: "intern_intro_rules_body",
    points: [
      "intern_intro_rules_point_1",
      "intern_intro_rules_point_2",
      "intern_intro_rules_point_3",
      "intern_intro_rules_point_4",
    ],
  },
};

export function InternCompanySectionView({
  section,
  themeHue,
  document,
  people,
  role = "intern",
  backHref = "/my",
}: {
  section: InternCompanySection;
  themeHue: number;
  document: RoleHomeDocument;
  people: { id: number; name: string; roleTitle: string; department: string }[];
  role?: "intern" | "employee";
  backHref?: string;
}) {
  const { t, locale } = useI18n();
  const content = SECTION_KEYS[section];
  const hasCustomDesign =
    document.elements.length > 0 ||
    document.background !== DEFAULT_BACKGROUND;

  return (
    <AppShell pathname={backHref} role={role} themeHue={themeHue}>
      <PageHeader
        title={t(content.title)}
        subtitle={t(content.body)}
        action={
          <Link href={backHref} className="btn btn-ghost">
            {role === "employee" ? t("eh_start_back") : t("main_menu_title")}
          </Link>
        }
      />
      <section className="panel" style={{ maxWidth: 980 }}>
        {hasCustomDesign ? (
          <DeferredCanvas document={document} className="role-home-live" />
        ) : (
          <ul className="intern-onboarding-points">
            {content.points.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>
        )}

        {section === "structure" ? (
          <ExpandOnClick
            hint={t("eh_long_hint")}
            action={`${t("eh_show_more")} (${people.length})`}
          >
            <div className="company-structure-list">
              {people.map((person) => (
                <article key={person.id} className="list-item">
                  <div>
                    <strong>
                      {localizeStaffText(person.name, locale, "name")}
                    </strong>
                    <div className="muted">
                      {localizeStaffText(person.roleTitle, locale, "role")}
                      {person.department
                        ? ` · ${localizeStaffText(
                            person.department,
                            locale,
                            "department",
                          )}`
                        : ""}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </ExpandOnClick>
        ) : null}
      </section>
    </AppShell>
  );
}
