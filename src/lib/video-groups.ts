// Playlist (toifa) bo'yicha videolarni bitta to'plam kartasiga jamlash.
// Bir toifada >= 2 video bo'lsa — bitta "playlist" kartasi; ochilganda alohida-alohida chiqadi.

export type VideoGroup<T> =
  | { kind: "playlist"; name: string; videos: T[] }
  | { kind: "single"; video: T };

export function groupVideos<T extends { id: string; category?: string | null }>(videos: T[], min = 2): VideoGroup<T>[] {
  const byCat = new Map<string, T[]>();
  for (const v of videos) {
    const k = (v.category || "Tizim").trim() || "Tizim";
    if (!byCat.has(k)) byCat.set(k, []);
    byCat.get(k)!.push(v);
  }
  const out: VideoGroup<T>[] = [];
  const done = new Set<string>();
  for (const v of videos) {
    const k = (v.category || "Tizim").trim() || "Tizim";
    const list = byCat.get(k)!;
    if (list.length >= min) {
      if (done.has(k)) continue;
      done.add(k);
      out.push({ kind: "playlist", name: k, videos: list });
    } else {
      out.push({ kind: "single", video: v });
    }
  }
  return out;
}

function toSeconds(d?: string | null): number {
  if (!d) return 0;
  const p = d.split(":").map((x) => Number(x));
  if (p.some((n) => !Number.isFinite(n))) return 0;
  return p.reduce((a, n) => a * 60 + n, 0);
}

/** "9:18" + "23:38" + ... -> "2:05:34" */
export function totalDuration(videos: { duration?: string | null }[]): string {
  const t = videos.reduce((a, v) => a + toSeconds(v.duration), 0);
  if (!t) return "";
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}