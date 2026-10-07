// YouTube playlist'ni API kalitisiz o'qiydi (ommaviy sahifa + InnerTube davomi).
// Faqat server tomonda ishlatiladi.

export type PlaylistItem = {
  videoId: string;
  title: string;
  duration: string; // "16:42"
  channel: string;
  thumb: string;
  url: string; // https://www.youtube.com/watch?v=ID
};

export type PlaylistData = {
  playlistId: string;
  title: string;
  channel: string;
  items: PlaylistItem[];
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const MAX_ITEMS = 500;

/** URL yoki xom ID'dan playlist ID (PL..., UU..., OL... va h.k.) */
export function parsePlaylistId(input: string): string | null {
  const s = (input || "").trim();
  if (/^[\w-]{13,64}$/.test(s) && /^(PL|UU|OL|FL|RD|LL)/.test(s)) return s;
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "youtube.com" && host !== "m.youtube.com" && host !== "music.youtube.com" && host !== "youtu.be") return null;
    const list = u.searchParams.get("list");
    if (list && /^[\w-]{10,64}$/.test(list)) return list;
  } catch {}
  return null;
}

function text(x: any): string {
  if (!x) return "";
  if (typeof x.simpleText === "string") return x.simpleText;
  if (Array.isArray(x.runs)) return x.runs.map((r: any) => r.text || "").join("");
  return "";
}

/** Obyekt ichidan kalit bo'yicha barcha qiymatlarni yig'adi */
function collect(node: any, key: string, out: any[] = []): any[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const n of node) collect(n, key, out);
    return out;
  }
  for (const k of Object.keys(node)) {
    if (k === key) out.push(node[k]);
    else collect(node[k], key, out);
  }
  return out;
}

function toItem(r: any): PlaylistItem | null {
  const id = r?.videoId;
  if (!id || typeof id !== "string") return null;
  const title = text(r.title).trim();
  if (!title || /^\[(Private|Deleted) video\]$/i.test(title)) return null;
  return {
    videoId: id,
    title,
    duration: text(r.lengthText) || "",
    channel: text(r.shortBylineText),
    thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${id}`,
  };
}

/** Yangi YouTube maketi: lockupViewModel (contentId = videoId) */
function lockupToItem(l: any): PlaylistItem | null {
  const id = l?.contentId;
  if (!id || typeof id !== "string" || !/^[\w-]{6,}$/.test(id)) return null;
  if (l?.contentType && !/VIDEO/.test(String(l.contentType))) return null;
  const title = String(l?.metadata?.lockupMetadataViewModel?.title?.content || "").trim();
  if (!title || /^\[(Private|Deleted) video\]$/i.test(title)) return null;
  const overlays: any[] = l?.contentImage?.thumbnailViewModel?.overlays || [];
  let duration = "";
  for (const o of overlays) {
    const b = o?.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel?.text;
    if (typeof b === "string" && /^\d{1,2}(:\d{2}){1,2}$/.test(b.trim())) { duration = b.trim(); break; }
  }
  return {
    videoId: id,
    title,
    duration,
    channel: "",
    thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    url: `https://www.youtube.com/watch?v=${id}`,
  };
}

/** Davom tokeni: ichma-ich continuationCommand.token */
function findToken(node: any): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  if (Array.isArray(node)) {
    for (const n of node) { const t = findToken(n); if (t) return t; }
    return undefined;
  }
  const cc = node.continuationCommand;
  if (cc && typeof cc.token === "string") return cc.token;
  for (const k of Object.keys(node)) { const t = findToken(node[k]); if (t) return t; }
  return undefined;
}

function extractJson(html: string, marker: string): any | null {
  const i = html.indexOf(marker);
  if (i < 0) return null;
  let start = html.indexOf("{", i);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let p = start; p < html.length; p++) {
    const ch = html[p];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, p + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

export async function fetchPlaylist(input: string): Promise<PlaylistData> {
  const playlistId = parsePlaylistId(input);
  if (!playlistId) throw new Error("YouTube playlist havolasi noto'g'ri (list=... bo'lishi kerak)");

  const res = await fetch(`https://www.youtube.com/playlist?list=${playlistId}&hl=uz`, {
    headers: { "User-Agent": UA, "Accept-Language": "uz,ru;q=0.8,en;q=0.6", Cookie: "CONSENT=YES+1; SOCS=CAI" },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`YouTube javob bermadi (HTTP ${res.status})`);
  const html = await res.text();

  const data = extractJson(html, "var ytInitialData =") || extractJson(html, 'ytInitialData"] =') || extractJson(html, "ytInitialData =");
  if (!data) throw new Error("Playlist ma'lumotini o'qib bo'lmadi (playlist yopiq yoki mavjud emas)");

  const title =
    data?.metadata?.playlistMetadataRenderer?.title ||
    text(data?.header?.playlistHeaderRenderer?.title) ||
    "YouTube playlist";
  const channel = text(data?.header?.playlistHeaderRenderer?.ownerText) || "";

  const items: PlaylistItem[] = [];
  const seen = new Set<string>();
  const push = (renderers: any[], lockups: any[] = []) => {
    const all = [...renderers.map(toItem), ...lockups.map(lockupToItem)];
    for (const it of all) {
      if (it && !seen.has(it.videoId)) {
        seen.add(it.videoId);
        items.push(it);
      }
    }
  };
  push(collect(data, "playlistVideoRenderer"), collect(data, "lockupViewModel"));

  // 100 tadan ko'p bo'lsa — davomi (continuation)
  const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
  const clientVersion = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1] || "2.20240101.00.00";
  let token: string | undefined = findToken(data);

  let guard = 0;
  while (token && apiKey && items.length < MAX_ITEMS && guard++ < 10) {
    const r = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({
        context: { client: { clientName: "WEB", clientVersion, hl: "uz" } },
        continuation: token,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) break;
    const j = await r.json();
    const before = items.length;
    push(collect(j, "playlistVideoRenderer"), collect(j, "lockupViewModel"));
    token = findToken(j);
    if (items.length === before) break;
  }

  if (items.length === 0) throw new Error("Playlistda ochiq video topilmadi");
  return { playlistId, title: String(title).trim(), channel, items };
}
