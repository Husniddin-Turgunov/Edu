"use client";

import { Layers, Clock, Play } from "lucide-react";
import { videoThumb } from "@/lib/video-thumb";
import { totalDuration } from "@/lib/video-groups";

type V = { id: string; title: string; duration?: string | null; url: string; poster?: string | null };

/** Playlist — bitta jamlangan karta (orqasida qatlamlar ko'rinadi). Bosilganda ochiladi.
 *
 *  AMALLAR (`footer` orqali beriladi) — video kartasi bilan BIR XIL tuzilma:
 *  keng asosiy tugma (`flex-1`) + kvadrat ikon tugmalari. Shu sababli playlist
 *  kartasi ham video kartasi kabi ko'rinadi va bir xil ishlaydi:
 *  Ochish · Ko'rish · Tahrirlash · Boshqarish.
 */
export function PlaylistCard({
  name,
  videos,
  onOpen,
  footer,
}: {
  name: string;
  videos: V[];
  onOpen: () => void;
  footer?: React.ReactNode;
}) {
  const thumb = videoThumb(videos[0]);
  const total = totalDuration(videos);
  return (
    <div className="relative pt-3" data-testid="playlist-card">
      <span className="absolute inset-x-5 top-0 h-6 rounded-t-2xl border border-blue-200/70 bg-white/50" />
      <span className="absolute inset-x-2.5 top-1.5 h-6 rounded-t-2xl border border-blue-200/70 bg-white/70" />
      <div className="liquid-video-card relative overflow-hidden rounded-2xl glass-card">
        <button type="button" onClick={onOpen} className="block w-full text-left">
          <div className="relative grid aspect-video place-items-center overflow-hidden bg-gradient-to-br from-[#0e1e3a] to-[#1a2855]">
            {thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt={name} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-black/30 backdrop-blur">
              <Play className="ml-0.5 h-6 w-6 fill-white text-white" />
            </div>
            <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/80 px-2 py-0.5 text-xs font-bold text-white">
              <Layers className="h-3 w-3" /> {videos.length} ta dars
            </span>
          </div>
          <div className="relative z-10 p-4">
            <h3 className="font-extrabold leading-snug text-neutral-900">{name}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
              <span className="inline-flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 font-bold text-blue-700">
                <Layers className="w-3 h-3" /> Playlist
              </span>
              {total && (
                <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5">
                  <Clock className="w-3 h-3" /> jami {total}
                </span>
              )}
            </div>
          </div>
        </button>
        {footer && <div className="px-4 pb-4">{footer}</div>}
      </div>
    </div>
  );
}