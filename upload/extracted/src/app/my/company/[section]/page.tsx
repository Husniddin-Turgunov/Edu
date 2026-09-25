import { notFound, redirect } from "next/navigation";
import {
  InternCompanySectionView,
  type InternCompanySection,
} from "@/components/InternCompanySectionView";
import {
  getEmployees,
  getPlatformUserById,
  getVisualContentPage,
  userNeedsVisualOnboarding,
} from "@/db/queries";
import { getSession } from "@/lib/auth";
import {
  onboardingVisualPageKey,
  preferredLocaleFromUser,
} from "@/lib/onboarding-visual";

const SECTIONS = new Set<InternCompanySection>([
  "history",
  "about",
  "structure",
  "rules",
]);

export const dynamic = "force-dynamic";

export default async function InternCompanySectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "participant") redirect("/login");
  if (
    session.participantKind !== "intern" &&
    session.participantKind !== "employee"
  ) {
    redirect("/my");
  }

  const { section: rawSection } = await params;
  if (!SECTIONS.has(rawSection as InternCompanySection)) notFound();
  const section = rawSection as InternCompanySection;

  const [user, employees] = await Promise.all([
    getPlatformUserById(session.userId),
    section === "structure" ? getEmployees() : Promise.resolve([]),
  ]);
  if (!user) redirect("/login?error=invalid");
  if (
    await userNeedsVisualOnboarding({
      userId: session.userId,
      role: session.role,
      participantKind: session.participantKind,
      preferredLocale: user.preferredLocale,
      onboardingCompletedAt: user.onboardingCompletedAt,
      onboardingStep: user.onboardingStep,
    })
  ) {
    redirect("/my/onboarding");
  }
  const locale = preferredLocaleFromUser(user.preferredLocale);
  const document = await getVisualContentPage(
    onboardingVisualPageKey(section, locale),
  );

  return (
    <InternCompanySectionView
      section={section}
      themeHue={user.avatarHue ?? 220}
      role={session.participantKind === "employee" ? "employee" : "intern"}
      backHref={session.participantKind === "employee" ? "/my/docs" : "/my"}
      document={document}
      people={employees.map((employee) => ({
        id: employee.id,
        name: employee.name,
        roleTitle: employee.roleTitle,
        department: employee.department,
      }))}
    />
  );
}
