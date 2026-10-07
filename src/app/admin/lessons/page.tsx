import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function AdminLessonsPage() {
  const session = await getSession();
  if (!session || !session.isAdmin) {
    redirect("/login");
  }
  redirect("/admin/onboarding");
}