"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Play, Clock, Layers } from "lucide-react";
import { groupVideos, totalDuration } from "@/lib/video-groups";

type V = {
  id: string;
  title: string;
  duration: string;
  showOnCourses?: boolean;
  coursesOrder?: number;
  showOnDashboard?: boolean;
  dashboardOrder?: number;
  category?: string;
  showInLessons?: boolean;
  lessonsOrder?: number;
};

/** Berilgan joy (courses/dashboard/lessons) uchun videolar ro'yxati */
export function usePlacedVideos() {
  const [videos, setVideos] = useState<V[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/videos", { cache: "no-store" });
        const data = await res.json();
        if (!cancelled && data?.ok) setVideos(data.videos || []);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);
  const by = (show: keyof V, order: keyof V) =>
    videos
      .filter((v) => (v as any)[show])
      .sort((a, b) => ((a as any)[order] || 0) - ((b as any)[order] || 0));
  return {
    courses: by("showOnCourses", "coursesOrder").slice(0, 3),
    dashboard: by("showOnDashboard", "dashboardOrder").slice(0, 2),
    lessons: by("showInLessons", "lessonsOrder"),
    loaded: true,
  };
}

/** Dars oynasi oxiridagi tegishli videolar bloki */
export function RelatedVideos() {
  const { lessons } = usePlacedVideos();
  if (lessons.length === 0) return null;
  const playCount = lessons.reduce((n, v) => n + (v.showInLessons ? 1 : 0), 0);
  return (
    <div className="liquid-video-card rounded-3xl p-6 backdrop-blur-xl">
      <h3 className="text-lg font-extrabold text-[color:var(--emerald-deep)] flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow">
          <Play className="h-4 w-4 fill-white ml-0.5" />
        </span>
        Tegishli videolar
        <span className="ml-1 rounded-full bg-white/70 border border-white/70 px-2.5 py-0.5 text-[11px] font-bold text-[color:var(--emerald-deep)]">
          {playCount} ta
        </span>
      </h3>
      <p className="mt-1 text-xs text-[color:var(--ink-soft)]">
        Darsga bog&apos;liq video darslar — bosing va oching.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {groupVideos(lessons).map((g) => g.kind === "playlist" ? (
          <Link
            key={"pl-" + g.name}
            href={`/courses/videos?cat=${encodeURIComponent(g.name)}`}
            className="group flex items-center gap-3 rounded-2xl border border-white/70 bg-white/70 p-3 transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#0e1e3a] to-[#1a2855] text-white">
              <Layers className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold text-[color:var(--emerald-deep)] group-hover:text-blue-600">{g.name}</span>
              <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[color:var(--ink-soft)]">
                <Clock className="h-3 w-3" /> {g.videos.length} ta dars{totalDuration(g.videos) ? ` · ${totalDuration(g.videos)}` : ""}
              </span>
            </span>
          </Link>
        ) : ((v) => (
          <Link
            key={v.id}
            href={`/courses/videos/${v.id}`}
            className="group flex items-center gap-3 rounded-2xl border border-white/70 bg-white/70 p-3 transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#0e1e3a] to-[#1a2855] text-white">
              <Play className="h-5 w-5 fill-white ml-0.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold text-[color:var(--emerald-deep)] group-hover:text-blue-600">
                {v.title}
              </span>
              {v.duration && (
                <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[color:var(--ink-soft)]">
                  <Clock className="h-3 w-3" /> {v.duration}
                </span>
              )}
            </span>
          </Link>
        ))(g.video))}
      </div>
    </div>
  );
}
