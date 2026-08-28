import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { WorkProfileView } from "@/components/ObserverProfileView";
import { db } from "@/db/index";
import { getActiveMentorship } from "@/db/mentorship";
import {
  ensureDb,
  getEmployeeById,
  getPlatformUserById,
} from "@/db/queries";
import { mentorRatings, platformUsers } from "@/db/schema";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MyProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  if (!session || session.role !== "participant") {
    redirect("/login");
  }

  if (
    session.participantKind !== "employee" &&
    session.participantKind !== "intern"
  ) {
    redirect("/my");
  }

  const [user, detail] = await Promise.all([
    getPlatformUserById(session.userId),
    session.employeeId ? getEmployeeById(session.employeeId) : null,
  ]);
  const employee = detail?.employee ?? null;

  let mentorRating: {
    mentorUserId: number;
    mentorName: string;
    currentScore: number | null;
  } | null = null;

  if (session.employeeId) {
    await ensureDb();
    let mentorUserId = employee?.mentorUserId ?? null;
    if (!mentorUserId && session.participantKind === "intern") {
      const mentorship = await getActiveMentorship(session.employeeId);
      mentorUserId = mentorship?.mentorUserId ?? null;
    }
    if (mentorUserId) {
      const [mentor, rating] = await Promise.all([
        db
          .select({
            id: platformUsers.id,
            displayName: platformUsers.displayName,
          })
          .from(platformUsers)
          .where(eq(platformUsers.id, mentorUserId))
          .limit(1)
          .then((rows) => rows[0] ?? null),
        db
          .select({ score: mentorRatings.score })
          .from(mentorRatings)
          .where(
            and(
              eq(mentorRatings.mentorUserId, mentorUserId),
              eq(mentorRatings.fromEmployeeId, session.employeeId),
            ),
          )
          .limit(1)
          .then((rows) => rows[0] ?? null),
      ]);
      if (mentor) {
        mentorRating = {
          mentorUserId: mentor.id,
          mentorName: mentor.displayName,
          currentScore: rating?.score ?? null,
        };
      }
    }
  }

  return (
    <WorkProfileView
      profile={{
        name: user?.displayName ?? employee?.name ?? session.name,
        login: user?.login ?? "—",
        password: user?.passwordPlain ?? "",
        role: user?.role ?? session.role,
        participantKind:
          user?.participantKind ?? session.participantKind ?? null,
        jobTitle:
          user?.profileJobTitle ??
          employee?.roleTitle ??
          (session.participantKind === "intern" ? "Стажёр" : "Сотрудник"),
        department:
          user?.profileDepartment ?? employee?.department ?? "AKELA GROUP",
        avatarData: user?.avatarData ?? null,
        avatarHue: user?.avatarHue ?? 220,
        isActive: user?.isActive ?? true,
      }}
      saved={params.saved === "1"}
      mentorRating={mentorRating}
      managerName={(detail?.manager as { name?: string } | null)?.name ?? null}
      mentorName={
        mentorRating?.mentorName ??
        ((detail?.mentor as { displayName?: string } | null)?.displayName ??
          null)
      }
    />
  );
}
