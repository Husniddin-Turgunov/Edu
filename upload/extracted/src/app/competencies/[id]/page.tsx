import { notFound } from "next/navigation";
import { RoleProfileDetailView } from "@/components/RoleProfileDetailView";
import {
  getRoleProfileDetail,
  listRoleCatalog,
} from "@/db/roles-catalog";
import { listLearningLessonsAdmin } from "@/db/learning";

export const dynamic = "force-dynamic";

export default async function RoleProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = await params;
  const id = Number(raw);
  if (!id) notFound();

  const [detail, catalog, lessons] = await Promise.all([
    getRoleProfileDetail(id),
    listRoleCatalog(true),
    listLearningLessonsAdmin({ limit: 150 }),
  ]);
  if (!detail) notFound();

  return (
    <RoleProfileDetailView
      detail={{
        ...detail,
        catalogRoles: catalog.map((row) => ({
          id: row.id,
          roleTitle: row.roleTitle,
        })),
        lessonOptions: lessons.map((lesson) => ({
          id: lesson.dbId,
          title: lesson.title,
        })),
      }}
    />
  );
}
