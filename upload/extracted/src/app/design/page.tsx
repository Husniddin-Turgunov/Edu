import { redirect } from "next/navigation";
import { DesignEditorView } from "@/components/visual-editor/DesignEditorView";
import {
  getAllOnboardingVisualPages,
  getAllRoleHomePages,
  getVisibilityPeople,
} from "@/db/queries";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DesignPage() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    redirect("/login");
  }

  const [pages, onboardingPages, people] = await Promise.all([
    getAllRoleHomePages(),
    getAllOnboardingVisualPages(),
    getVisibilityPeople(),
  ]);
  return (
    <DesignEditorView
      pages={pages}
      onboardingPages={onboardingPages}
      people={people}
    />
  );
}
