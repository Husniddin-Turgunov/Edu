import { redirect } from "next/navigation";
import { MentorsAdminView } from "@/components/MentorsAdminView";
import { listMentorsDirectory } from "@/db/mentors";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MentorsPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");
  const mentors = await listMentorsDirectory();
  return <MentorsAdminView mentors={mentors} />;
}
