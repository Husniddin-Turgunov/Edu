import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { EmployeeStartView } from "@/components/EmployeeStartView";
import { getEmployeeStartData } from "@/db/employee-home";
import { getPlatformUserById, userNeedsVisualOnboarding } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EmployeeStartPage() {
  const session = await getSession();
  if (!session || session.role !== "participant") redirect("/login");
  if (session.participantKind !== "employee") redirect("/my");
  if (!session.employeeId) redirect("/login?error=invalid");

  const user = await getPlatformUserById(session.userId);
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

  const data = await getEmployeeStartData({
    employeeId: session.employeeId,
    login: user.login,
    onboardingCompleted: Boolean(user.onboardingCompletedAt),
  });
  if (!data) redirect("/my");

  const hdrs = await headers();
  const host =
    hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const entryUrl = `${proto}://${host}/login`;

  return (
    <EmployeeStartView
      data={data}
      entryUrl={entryUrl}
      themeHue={user.avatarHue ?? 220}
    />
  );
}
