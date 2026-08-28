import { InterviewsView } from "@/components/InterviewsView";
import { getInterviewsData } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function InterviewsPage() {
  const data = await getInterviewsData();
  return (
    <InterviewsView
      interviews={data.interviews}
      candidates={data.candidates.map((c) => ({
        id: c.id,
        name: c.name,
        roleTitle: c.roleTitle,
      }))}
      hrUsers={data.hrUsers}
    />
  );
}
