import type { MessageKey } from "@/lib/i18n";

export type AdminHubId =
  | "desk"
  | "hiring"
  | "staff"
  | "development"
  | "methodology"
  | "reports"
  | "system";

export type AdminHubTab = {
  id: string;
  href: string;
  labelKey: MessageKey;
  match?: string[];
};

export type AdminHub = {
  id: AdminHubId;
  navKey: MessageKey;
  primaryHref: string;
  match: string[];
  tabs: AdminHubTab[];
};

/**
 * 7 главных разделов админки.
 * Вкладки ведут на существующие экраны — функционал не удаляется.
 */
export const ADMIN_HUBS: AdminHub[] = [
  {
    id: "desk",
    navKey: "nav_admin_desk",
    primaryHref: "/",
    match: ["/"],
    tabs: [],
  },
  {
    id: "hiring",
    navKey: "nav_admin_hiring",
    primaryHref: "/candidates",
    match: [
      "/candidates",
      "/interviews",
      "/take-candidate",
      "/trial",
      "/interns",
      "/results",
      "/assessments/kind/candidate",
      "/assessments/kind/trial",
    ],
    tabs: [
      { id: "candidates", href: "/candidates", labelKey: "admin_tab_candidates" },
      { id: "interviews", href: "/interviews", labelKey: "admin_tab_interviews" },
      {
        id: "entrance_tests",
        href: "/assessments/kind/candidate",
        labelKey: "admin_tab_entrance_tests",
        match: ["/assessments/kind/candidate"],
      },
      {
        id: "test_results",
        href: "/results",
        labelKey: "admin_tab_test_results",
        match: ["/results"],
      },
      {
        id: "trial",
        href: "/trial",
        labelKey: "admin_tab_trial",
        match: ["/trial", "/interns"],
      },
    ],
  },
  {
    id: "staff",
    navKey: "nav_admin_staff",
    primaryHref: "/employees",
    match: ["/employees", "/mentors"],
    tabs: [
      {
        id: "people",
        href: "/employees?tab=people",
        labelKey: "admin_tab_people",
        match: ["/employees"],
      },
      {
        id: "org",
        href: "/employees?tab=org",
        labelKey: "admin_tab_org",
        match: ["/employees"],
      },
      { id: "mentors", href: "/mentors", labelKey: "admin_tab_mentors" },
      {
        id: "competencies",
        href: "/employees?tab=competencies",
        labelKey: "admin_tab_staff_competencies",
        match: ["/employees"],
      },
      {
        id: "history",
        href: "/employees?tab=history",
        labelKey: "admin_tab_moves_history",
        match: ["/employees"],
      },
      {
        id: "archive",
        href: "/employees?tab=archive",
        labelKey: "admin_tab_archive",
        match: ["/employees"],
      },
    ],
  },
  {
    id: "development",
    navKey: "nav_admin_development",
    primaryHref: "/learning",
    match: ["/learning", "/learning-tests", "/attestation"],
    tabs: [
      {
        id: "active",
        href: "/learning?focus=active",
        labelKey: "admin_tab_learning_active",
        match: ["/learning"],
      },
      {
        id: "programs",
        href: "/learning?focus=programs",
        labelKey: "admin_tab_learning_programs",
        match: ["/learning"],
      },
      {
        id: "lessons",
        href: "/learning?focus=lessons",
        labelKey: "admin_tab_learning_lessons",
        match: ["/learning"],
      },
      {
        id: "lesson_tests",
        href: "/learning-tests",
        labelKey: "admin_tab_lesson_tests",
        match: ["/learning-tests"],
      },
      {
        id: "attestation",
        href: "/attestation",
        labelKey: "admin_tab_attestations",
        match: ["/attestation"],
      },
      {
        id: "calendar",
        href: "/learning?focus=calendar",
        labelKey: "admin_tab_learning_calendar",
        match: ["/learning"],
      },
      {
        id: "overdue",
        href: "/learning?focus=overdue",
        labelKey: "admin_tab_learning_overdue",
        match: ["/learning"],
      },
      {
        id: "ready_middle",
        href: "/learning?focus=ready",
        labelKey: "admin_tab_ready_middle",
        match: ["/learning"],
      },
    ],
  },
  {
    id: "methodology",
    navKey: "nav_admin_methodology",
    primaryHref: "/competencies",
    match: ["/competencies", "/assessments", "/methodology"],
    tabs: [
      {
        id: "roles",
        href: "/competencies",
        labelKey: "admin_tab_roles",
        match: ["/competencies"],
      },
      {
        id: "levels",
        href: "/competencies?focus=levels&hub=methodology",
        labelKey: "admin_tab_levels",
        match: ["/competencies"],
      },
      {
        id: "entrance_lib",
        href: "/assessments/kind/candidate?hub=methodology",
        labelKey: "admin_tab_entrance_lib",
        match: ["/assessments/kind/candidate"],
      },
      {
        id: "trial_tests",
        href: "/assessments/kind/trial?hub=methodology",
        labelKey: "admin_tab_trial_tests",
        match: ["/assessments/kind/trial"],
      },
      {
        id: "trial_lessons",
        href: "/learning?focus=trial&hub=methodology",
        labelKey: "admin_tab_trial_lessons",
        match: ["/learning"],
      },
      {
        id: "programs_3m",
        href: "/learning?focus=programs&hub=methodology",
        labelKey: "admin_tab_programs_3m",
        match: ["/learning"],
      },
      {
        id: "tests_lib",
        href: "/assessments?hub=methodology",
        labelKey: "admin_tab_test_library",
        match: ["/assessments"],
      },
      {
        id: "attest_materials",
        href: "/attestation?hub=methodology",
        labelKey: "admin_tab_attest_materials",
        match: ["/attestation"],
      },
      {
        id: "norms",
        href: "/methodology/norms",
        labelKey: "admin_tab_norms",
        match: ["/methodology/norms"],
      },
      {
        id: "templates",
        href: "/methodology/templates",
        labelKey: "admin_tab_templates",
        match: ["/methodology/templates"],
      },
    ],
  },
  {
    id: "reports",
    navKey: "nav_admin_reports",
    primaryHref: "/reports",
    match: ["/reports"],
    tabs: [
      { id: "hub", href: "/reports", labelKey: "admin_tab_reports_hub" },
      {
        id: "hiring",
        href: "/reports/hiring",
        labelKey: "admin_tab_reports_hiring",
        match: ["/reports/hiring"],
      },
      {
        id: "testing",
        href: "/reports/testing",
        labelKey: "admin_tab_reports_testing",
        match: ["/reports/testing"],
      },
      {
        id: "trial",
        href: "/reports/trial",
        labelKey: "admin_tab_reports_trial",
        match: ["/reports/trial"],
      },
      {
        id: "learning",
        href: "/reports/learning",
        labelKey: "admin_tab_reports_learning",
        match: ["/reports/learning"],
      },
      {
        id: "mentors",
        href: "/reports/mentors",
        labelKey: "admin_tab_reports_mentors",
        match: ["/reports/mentors"],
      },
      {
        id: "attestations",
        href: "/reports/attestations",
        labelKey: "admin_tab_reports_attestations",
        match: ["/reports/attestations"],
      },
    ],
  },
  {
    id: "system",
    navKey: "nav_admin_system",
    primaryHref: "/admin/system",
    match: [
      "/admin/system",
      "/integrations",
      "/settings",
      "/access",
      "/design",
    ],
    tabs: [
      {
        id: "overview",
        href: "/admin/system/overview",
        labelKey: "sys_tab_overview",
        match: ["/admin/system/overview"],
      },
      {
        id: "users",
        href: "/admin/system/users",
        labelKey: "sys_tab_users",
        match: ["/admin/system/users", "/access"],
      },
      {
        id: "integrations",
        href: "/admin/system/integrations",
        labelKey: "sys_tab_integrations",
        match: ["/admin/system/integrations", "/integrations"],
      },
      {
        id: "company",
        href: "/admin/system/company",
        labelKey: "sys_tab_company",
        match: ["/admin/system/company", "/settings/company"],
      },
      {
        id: "security",
        href: "/admin/system/security",
        labelKey: "sys_tab_security",
        match: ["/admin/system/security", "/settings/security"],
      },
      {
        id: "audit",
        href: "/admin/system/audit",
        labelKey: "sys_tab_audit",
        match: ["/admin/system/audit", "/settings/audit"],
      },
      {
        id: "design",
        href: "/admin/system/design",
        labelKey: "sys_tab_design",
        match: ["/admin/system/design", "/design"],
      },
    ],
  },
];

function hubById(id: AdminHubId) {
  return ADMIN_HUBS.find((hub) => hub.id === id) ?? null;
}

function pathnameMatches(pathname: string, prefix: string) {
  const bare = prefix.split("?")[0];
  return pathname === bare || pathname.startsWith(`${bare}/`);
}

export function resolveAdminHub(pathname: string | undefined): AdminHub | null {
  if (!pathname) return null;
  if (pathname === "/") return hubById("desk");

  // More specific hubs first to avoid /learning stealing methodology tabs.
  if (pathnameMatches(pathname, "/methodology")) {
    return hubById("methodology");
  }

  const hiring = hubById("hiring");
  if (hiring?.match.some((prefix) => pathnameMatches(pathname, prefix))) {
    // assessments/kind belong to hiring; bare /assessments → methodology
    if (
      pathnameMatches(pathname, "/assessments") &&
      !pathnameMatches(pathname, "/assessments/kind")
    ) {
      return hubById("methodology");
    }
    if (pathnameMatches(pathname, "/assessments/kind")) {
      return hiring;
    }
    if (
      !pathnameMatches(pathname, "/assessments") &&
      !pathnameMatches(pathname, "/learning") &&
      !pathnameMatches(pathname, "/attestation") &&
      !pathnameMatches(pathname, "/competencies")
    ) {
      return hiring;
    }
    if (
      pathnameMatches(pathname, "/candidates") ||
      pathnameMatches(pathname, "/interviews") ||
      pathnameMatches(pathname, "/take-candidate") ||
      pathnameMatches(pathname, "/trial") ||
      pathnameMatches(pathname, "/interns") ||
      pathnameMatches(pathname, "/results") ||
      pathnameMatches(pathname, "/assessments/kind")
    ) {
      return hiring;
    }
  }

  if (
    pathnameMatches(pathname, "/employees") ||
    pathnameMatches(pathname, "/mentors")
  ) {
    return hubById("staff");
  }

  // Competencies default to methodology (должности), except when coming from staff tab
  // — same URL; methodology is the catalog home.
  if (pathnameMatches(pathname, "/competencies")) {
    return hubById("methodology");
  }

  if (
    pathnameMatches(pathname, "/learning") ||
    pathnameMatches(pathname, "/learning-tests") ||
    pathnameMatches(pathname, "/attestation")
  ) {
    return hubById("development");
  }

  if (pathnameMatches(pathname, "/assessments")) {
    return hubById("methodology");
  }

  if (pathnameMatches(pathname, "/reports")) {
    return hubById("reports");
  }

  const system = hubById("system");
  if (system?.match.some((prefix) => pathnameMatches(pathname, prefix))) {
    return system;
  }

  return null;
}

export function isAdminHubTabActive(
  pathname: string,
  tab: AdminHubTab,
  search?: string,
) {
  const params = new URLSearchParams(search ?? "");
  const tabUrl = new URL(tab.href, "http://local");
  const tabParams = tabUrl.searchParams;
  const pathOk = pathnameMatches(pathname, tabUrl.pathname);
  if (!pathOk) return false;

  // Query-aware tabs (employees?tab=, learning?focus=)
  if (tabParams.has("tab")) {
    const wanted = tabParams.get("tab");
    const current = params.get("tab") || "people";
    return current === wanted;
  }
  if (tabParams.has("focus")) {
    const wanted = tabParams.get("focus");
    const current = params.get("focus");
    if (!current && (tab.id === "programs" || tab.id === "programs_3m")) {
      return pathname === "/learning";
    }
    return current === wanted;
  }

  const prefixes = tab.match ?? [tab.href.split("?")[0]];
  return prefixes.some((prefix) => {
    const bare = prefix.split("?")[0];
    if (bare === "/settings" && tab.id === "settings") {
      return pathname === "/settings";
    }
    if (bare === "/assessments" && tab.id === "tests_lib") {
      return (
        pathname === "/assessments" ||
        (pathname.startsWith("/assessments/") &&
          !pathname.startsWith("/assessments/kind/"))
      );
    }
    if (bare === "/competencies" && tab.id === "roles") {
      return (
        (pathname === "/competencies" ||
          pathname.startsWith("/competencies/")) &&
        params.get("focus") !== "levels"
      );
    }
    if (bare === "/competencies" && tab.id === "levels") {
      return pathname.startsWith("/competencies") && params.get("focus") === "levels";
    }
    return pathnameMatches(pathname, bare);
  });
}

export function adminSidebarLinks() {
  // Desk opens via logo — not a sidebar item.
  return ADMIN_HUBS.filter((hub) => hub.id !== "desk").map((hub) => ({
    href: hub.primaryHref,
    key: hub.navKey,
    match: hub.match,
  }));
}
