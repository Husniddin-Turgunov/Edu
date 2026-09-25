"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";

export type MyCourses = {
  loading: boolean;
  isAdmin: boolean;
  hasOnboarding: boolean;
  jobIds: string[]; // cuid ro'yxati; admin uchun ["*"]
  hasJob: (jobId: string | undefined | null) => boolean;
  reload: () => void;
};

/**
 * Joriy foydalanuvchiga biriktirilgan darslar.
 * Biriktirilmagan user: hasOnboarding=false, jobIds=[].
 * Admin: hamma narsa ruxsat.
 */
export function useMyCourses(): MyCourses {
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasOnboarding, setHasOnboarding] = useState(false);
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(status === "loading");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/my-courses", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (data?.ok) {
          const admin = !!data.isAdmin;
          setIsAdmin(admin);
          setHasOnboarding(admin || !!data.onboarding);
          setJobIds(admin ? ["*"] : (data.jobIds || []).map(String));
        } else {
          setIsAdmin(false);
          setHasOnboarding(false);
          setJobIds([]);
        }
      } catch {
        if (!cancelled) {
          setIsAdmin(false);
          setHasOnboarding(false);
          setJobIds([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status, tick]);

  const hasJob = useCallback(
    (jobId: string | undefined | null) => {
      if (!jobId) return false;
      if (jobIds.includes("*")) return true;
      return jobIds.includes(String(jobId));
    },
    [jobIds]
  );

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { loading, isAdmin, hasOnboarding, jobIds, hasJob, reload };
}

/** Ruxsat yo'q ekrani matni (bir xil uslubda) */
export const NO_ACCESS_UZ = {
  title: "Bu dars sizga biriktirilmagan",
  body: "Darslar admin tomonidan biriktirilgandan so'ng ko'rinadi. Iltimos, rahbaringiz yoki admin bilan bog'laning.",
};
