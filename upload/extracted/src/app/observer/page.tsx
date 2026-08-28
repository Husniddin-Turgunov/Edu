import { redirect } from "next/navigation";
import { ObserverView } from "@/components/ObserverView";
import { getObserverDashboard, getPlatformUserById } from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ObserverPage() {
  const session = await getSession();
  if (
    !session ||
    (session.role !== "observer" && session.role !== "manager")
  ) {
    redirect("/login");
  }

  const [data, user] = await Promise.all([
    getObserverDashboard(),
    getPlatformUserById(session.userId),
  ]);

  return (
    <ObserverView
      data={data}
      themeHue={user?.avatarHue ?? 220}
      role={session.role === "manager" ? "manager" : "observer"}
    />
  );
}
