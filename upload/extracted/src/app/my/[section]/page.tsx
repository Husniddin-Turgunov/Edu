import { notFound, redirect } from "next/navigation";
import { EmployeeCabinetSectionView } from "@/components/EmployeeCabinetSectionView";
import { getPlatformUserById } from "@/db/queries";
import { listNotificationsForUser } from "@/db/mentorship";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

const KINDS = ["notifications"] as const;

type CabinetKind = (typeof KINDS)[number];

function isCabinetKind(value: string): value is CabinetKind {
  return (KINDS as readonly string[]).includes(value);
}

export default async function EmployeeCabinetSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!isCabinetKind(section)) notFound();

  const session = await getSession();
  if (!session || session.role !== "participant") redirect("/login");
  if (session.participantKind !== "employee") redirect("/my");
  if (!session.employeeId) redirect("/login?error=invalid");

  const user = await getPlatformUserById(session.userId);
  if (!user) redirect("/login?error=invalid");

  const notifications =
    section === "notifications"
      ? await listNotificationsForUser(session.userId, 40)
      : [];

  return (
    <EmployeeCabinetSectionView
      kind={section}
      themeHue={user.avatarHue ?? 220}
      notifications={notifications.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        href: row.href,
        createdAt: row.createdAt,
        readAt: row.readAt,
      }))}
    />
  );
}
