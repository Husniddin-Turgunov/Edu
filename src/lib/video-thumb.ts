import { getEmbedUrl } from "@/components/VideoPlayer";

/** Video muqovasi: yuklangan poster → YouTube avtomatik thumb → null (placeholder) */
export function videoThumb(v: { poster?: string | null; url: string }): string | null {
  if (v.poster) return v.poster;
  const e = getEmbedUrl(v.url || "");
  if (e?.type === "youtube") {
    const id = e.embed.split("/embed/")[1]?.split("?")[0];
    if (id) return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }
  return null;
}
