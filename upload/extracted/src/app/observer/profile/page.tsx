import { redirect } from "next/navigation";
import { WorkProfileView } from "@/components/ObserverProfileView";
import { getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ObserverProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  if (
    !session ||
    (session.role !== "observer" && session.role !== "manager")
  ) {
    redirect("/login");
  }

  const user = await getPlatformUserById(session.userId);

  return (
    <WorkProfileView
      profile={{
        name: user?.displayName ?? session.name,
        login: user?.login ?? "—",
        password: user?.passwordPlain ?? "",
        role: user?.role ?? session.role,
        jobTitle:
          user?.profileJobTitle ??
          (session.role === "manager" ? "Руководитель" : "Наблюдатель"),
        department: user?.profileDepartment ?? "Руководство",
        avatarData: user?.avatarData ?? null,
        avatarHue: user?.avatarHue ?? 220,
        isActive: user?.isActive ?? true,
      }}
      saved={params.saved === "1"}
    />
  );
}
