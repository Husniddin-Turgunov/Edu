import { AccessView } from "@/components/AccessView";
import {
  getAllPlatformUsers,
  getCandidates,
  getEmployees,
} from "@/db/queries";
import { getTerminalQueuesOverview } from "@/db/terminal";
import { getSession } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    login?: string;
    pass?: string;
    name?: string;
    type?: string;
  }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");
  const [users, candidates, employees, terminalQueues] =
    await Promise.all([
    getAllPlatformUsers(),
    getCandidates(),
    getEmployees(),
    getTerminalQueuesOverview(),
  ]);

  const hdrs = await headers();
  const host =
    hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "https";
  const entryUrl = `${proto}://${host}/login`;

  return (
    <AccessView
      users={[
        ...users,
        ...[1, 2, 3, 4, 5].map((slotNumber) => {
          const active = terminalQueues[slotNumber]?.active;
          return {
            id: -slotNumber,
            login: `/terminal/${slotNumber}`,
            displayName: `Аккаунт ваканта ${slotNumber}`,
            role: "terminal",
            participantKind: "candidate",
            isActive: true,
            slotNumber,
            terminalStatus: active?.status ?? "free",
            currentCandidate: active?.candidateName ?? null,
          };
        }),
      ]}
      candidates={candidates.map((c) => ({
        id: c.id,
        name: c.name,
        subtitle: c.roleTitle,
      }))}
      employees={employees.map((e) => ({
        id: e.id,
        name: e.name,
        subtitle: `${e.roleTitle} · ${e.department}`,
      }))}
      entryUrl={entryUrl}
      createdFlash={
        params.created && params.login && params.pass
          ? {
              login: params.login,
              password: params.pass,
              name: params.name ?? "",
              type: params.type ?? "participant",
            }
          : null
      }
    />
  );
}
