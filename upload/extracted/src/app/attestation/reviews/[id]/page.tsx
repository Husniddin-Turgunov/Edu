import { notFound, redirect } from "next/navigation";
import { AttestationReviewView } from "@/components/AttestationReviewView";
import { getAttestationReview } from "@/db/attestation-reviews";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AttestationReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "admin") redirect("/login");
  const { id } = await params;
  const detail = await getAttestationReview(Number(id));
  if (!detail) notFound();
  return <AttestationReviewView detail={detail} />;
}
