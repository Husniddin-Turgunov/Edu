import { redirect } from "next/navigation";
import { AppShell } from "@/components/ui";
import { EmployeeHomeView } from "@/components/EmployeeHomeView";
import { DeferredCanvas } from "@/components/DeferredCanvas";
import { getEmployeeHomeDashboard } from "@/db/employee-home";
import {
  getPlatformUserById,
  getRoleHomePage,
  getVisualContentPage,
  userNeedsVisualOnboarding,
} from "@/db/queries";
import { getSession } from "@/lib/auth";
import { InternHomeMenu } from "@/components/InternHomeMenu";
import { DEFAULT_BACKGROUND, documentVisibleToUser } from "@/lib/role-home";
import {
  onboardingVisualPageKey,
  preferredLocaleFromUser,
} from "@/lib/onboarding-visual";

export const dynamic = "force-dynamic";

export default async function MyHomePage() {
  const session = await getSession();
  if (!session || session.role !== "participant") redirect("/login");

  if (
    session.participantKind !== "employee" &&
    session.participantKind !== "intern"
  ) {
    // Candidates keep the old portal home via dedicated view
    redirect("/my/tests");
  }

  const audience =
    session.participantKind === "intern" ? "intern" : "employee";
  const [user, layout, home] = await Promise.all([
    getPlatformUserById(session.userId),
    getRoleHomePage(audience),
    session.participantKind === "employee" && session.employeeId
      ? getEmployeeHomeDashboard(session.employeeId)
      : Promise.resolve(null),
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

  const showCanvas =
    layout.elements.length > 0 ||
    (layout.background && layout.background !== DEFAULT_BACKGROUND);
  const internName = user.displayName || session.name;
  const permanentLayout = await getVisualContentPage(
    onboardingVisualPageKey(
      "permanent",
      preferredLocaleFromUser(user.preferredLocale),
    ),
  );
  const showPermanent =
    documentVisibleToUser(permanentLayout, {
      userId: session.userId,
      audience,
    }) &&
    (permanentLayout.elements.length > 0 ||
      permanentLayout.background !== DEFAULT_BACKGROUND);
  const personalizedPermanent = permanentLayout
    ? {
        ...permanentLayout,
        elements: permanentLayout.elements.map((element) =>
          element.type === "text"
            ? {
                ...element,
                content: element.content.replaceAll("{name}", internName),
              }
            : element,
        ),
      }
    : null;

  return (
    <AppShell
      pathname="/my"
      role={session.participantKind === "intern" ? "intern" : "employee"}
      themeHue={user?.avatarHue ?? 220}
    >
      {session.participantKind === "intern" ? (
        <>
          {showPermanent && personalizedPermanent ? (
            <DeferredCanvas
              document={personalizedPermanent}
              className="role-home-live intern-permanent-welcome"
            />
          ) : null}
          <InternHomeMenu name={internName} showHeader />
          {showCanvas ? (
            <DeferredCanvas document={layout} className="role-home-live" />
          ) : null}
        </>
      ) : (
        <>
          {showPermanent && personalizedPermanent ? (
            <DeferredCanvas
              document={personalizedPermanent}
              className="role-home-live intern-permanent-welcome"
            />
          ) : null}
          {home ? <EmployeeHomeView data={home} /> : null}
          {showCanvas ? (
            <DeferredCanvas document={layout} className="role-home-live" />
          ) : null}
        </>
      )}
    </AppShell>
  );
}
