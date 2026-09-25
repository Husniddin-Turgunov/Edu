"use client";

import Link from "next/link";
import { Lock, ArrowLeft } from "lucide-react";
import { LiquidBackground } from "@/components/akela/LiquidBackground";
import { NO_ACCESS_UZ } from "@/hooks/useMyCourses";

/** Biriktirilmagan darsga kirilganda ko'rsatiladigan ekran */
export function NoAccess() {
  return (
    <main className="min-h-screen grid place-items-center bg-transparent p-4">
      <LiquidBackground />
      <div className="relative glass-card rounded-3xl p-10 text-center max-w-md w-full">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg">
          <Lock className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-extrabold text-[color:var(--emerald-deep)]">{NO_ACCESS_UZ.title}</h1>
        <p className="mt-3 text-sm text-[color:var(--ink-soft)] leading-relaxed">{NO_ACCESS_UZ.body}</p>
        <Link
          href="/courses"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg hover:scale-105 transition-transform"
        >
          <ArrowLeft className="h-4 w-4" /> Mening darslarim
        </Link>
      </div>
    </main>
  );
}
