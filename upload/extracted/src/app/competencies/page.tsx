import { CompetenciesView } from "@/components/CompetenciesView";
import { listRoleCatalog } from "@/db/roles-catalog";
import { getCompetenciesWithLevels } from "@/db/queries";

export const dynamic = "force-dynamic";

export default async function CompetenciesPage() {
  const [{ levels }, roles] = await Promise.all([
    getCompetenciesWithLevels(),
    listRoleCatalog(true),
  ]);
  return <CompetenciesView roles={roles} levels={levels} />;
}
