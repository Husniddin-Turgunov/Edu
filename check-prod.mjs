/* Production tekshiruvi: edu.akelagroup.uz dagi /tests/[id] sahifasidagi JS
 * bundle ichida yangi review kodlari bormi?  Ishlatish: node check-prod.mjs [url]
 */
const URL_TO_CHECK = process.argv[2] || "https://edu.akelagroup.uz/tests/cmudoc4hm0000jt04jdroy06m";

const MARKERS = [
  "Javob berilmagan",                 // yangi savol holati badge
  "review-truncated-warning",         // eski kesilgan saqlash ogohlantirishi
  "badge-question-unanswered",        // testid
  "review-question",                  // testid (asosiy)
];

async function main() {
  const res = await fetch(URL_TO_CHECK, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0" } });
  const html = await res.text();
  console.log("page:", res.status, "| url:", res.url, "| html length:", html.length);
  console.log("deployment header x-vercel-id:", res.headers.get("x-vercel-id") || "(yo'q)");

  const srcs = [...html.matchAll(/src="([^"]+\.js[^"]*)"/g)].map((m) => m[1]);
  console.log("script tags:", srcs.length);

  const found = {};
  for (const m of MARKERS) found[m] = false;
  for (const s of srcs) {
    const u = s.startsWith("http") ? s : new URL(s, res.url).href;
    let txt = "";
    try {
      txt = await fetch(u).then((r) => r.text());
    } catch {
      continue;
    }
    for (const m of MARKERS) {
      if (txt.includes(m)) found[m] = true;
    }
  }

  console.log("\nMarkerlar (JS bundle ichida):");
  let all = true;
  for (const [m, ok] of Object.entries(found)) {
    console.log(`  ${ok ? "OK  " : "YO'Q"}  ${m}`);
    if (!ok) all = false;
  }

  // Qo'shimcha: sahifa HTML ichida eski/yangi review izlari
  const inline = ["badge-question-unanswered", "Javob berilmagan"].filter((m) => html.includes(m));
  console.log("\nHTML ichida:", inline.length ? inline.join(", ") : "(inline yo'q — normal)");

  console.log(all ? "\nNATIJA: OK - yangi review kodi production'da bor" : "\nNATIJA: ba'zi markerlar topilmadi");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
