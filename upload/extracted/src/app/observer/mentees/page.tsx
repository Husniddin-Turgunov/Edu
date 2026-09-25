import { redirect } from "next/navigation";
import { ManagerMenteesView } from "@/components/ManagerMenteesView";
import { getPlatformUserById } from "@/db/queries";
import {
  countUnreadNotifications,
  listMenteesForMentor,
  listNotificationsForUser,
} from "@/db/mentorship";
import { getManagerMentorLoad } from "@/db/manager-cabinet";
import { getMentorCabinet } from "@/db/mentors";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ManagerMenteesPage() {
  const session = await getSession();
  if (!session || session.role !== "manager") redirect("/observer");

  const [user, mentees, notifications, unreadCount, cabinet, mentorLoad] = await Promise.all([
    getPlatformUserById(session.userId),
    listMenteesForMentor(session.userId),
    listNotificationsForUser(session.userId),
    countUnreadNotifications(session.userId),
    getMentorCabinet(session.userId),
    getManagerMentorLoad(session.userId),
  ]);

  return (
    <ManagerMenteesView
      themeHue={user?.avatarHue ?? 220}
      unreadCount={unreadCount}
      notifications={notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        href: n.href,
        createdAt: n.createdAt,
        readAt: n.readAt,
      }))}
      mentees={
        cabinet?.interns ??
        mentees.map(({ mentorship, intern }) => ({
          id: intern.id,
          name: intern.name,
          roleTitle: intern.roleTitle,
          department: intern.department,
          currentLevel: intern.currentLevel,
          trialStartsAt: mentorship.trialStartsAt,
          trialEndsAt: mentorship.trialEndsAt,
          status: mentorship.status,
        }))
      }
      employees={cabinet?.employees ?? []}
      queue={cabinet?.queue ?? []}
      overdue={cabinet?.overdue ?? []}
      lessonsToday={cabinet?.lessonsToday ?? []}
      upcomingAttestations={cabinet?.upcomingAttestations ?? []}
      weakCompetencies={cabinet?.weakCompetencies ?? []}
      metrics={cabinet?.metrics}
      mentorLoad={mentorLoad?.rows ?? []}
    />
  );
}
