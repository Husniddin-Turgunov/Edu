/**
 * Google Material Symbols ikonkalaridan "Liquid Glass" uslubidagi PNG lar yasaydi.
 *
 * Kirish:  tmp-icons/<material-nomi>.svg   (skript oldidan yuklab olinadi)
 * Chiqish: public/icons/glass/<nom>.png    (512x512, shaffof fon)
 *
 * Ishga tushirish:  node scripts/build-glass-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SRC = "tmp-icons";
const OUT = "public/icons/glass";

/** nom -> [rang1, rang2] (Material Symbols fayl nomi bilan bir xil) */
const ICONS = {
  monitoring: ["#34d399", "#0f766e"],
  group: ["#60a5fa", "#4338ca"],
  pending_actions: ["#fbbf24", "#b45309"],
  fact_check: ["#c084fc", "#6d28d9"],
  info: ["#94a3b8", "#1e40af"],
  refresh: ["#22d3ee", "#0e7490"],
  home: ["#818cf8", "#3730a3"],
  person: ["#fb7185", "#9f1239"],
  image: ["#e879f9", "#86198f"],
  picture_as_pdf: ["#f87171", "#991b1b"],
  checklist: ["#a3e635", "#3f6212"],
  emoji_events: ["#fcd34d", "#b45309"],
  check_circle: ["#34d399", "#047857"],
  cancel: ["#f87171", "#b91c1c"],
  workspace_premium: ["#a78bfa", "#5b21b6"],
  arrow_back: ["#cbd5e1", "#334155"],
  apps: ["#2dd4bf", "#0f766e"],
  campaign: ["#fb923c", "#c2410c"],
  download: ["#34d399", "#065f46"],
  schedule: ["#38bdf8", "#075985"],
};

const SIZE = 512;

/** Material SVG (viewBox="0 -960 960 960") dagi glyph yo'lini oladi */
function glyphPath(svg) {
  const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  return paths.join(" ");
}

function glassSvg(d, c1, c2) {
  const glyphSize = 216;
  const scale = glyphSize / 960;
  const t = SIZE / 2 - glyphSize / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}" stop-opacity="0.98"/>
      <stop offset="1" stop-color="${c2}" stop-opacity="0.96"/>
    </linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="0.75" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.40"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.05"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.22"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="26"/>
    </filter>
  </defs>
  <!-- tashqi yumshoq nur (liquid glass) -->
  <rect x="58" y="58" width="396" height="396" rx="128" fill="${c1}" opacity="0.60" filter="url(#glow)"/>
  <!-- shisha kosacha -->
  <rect x="26" y="26" width="460" height="460" rx="142" fill="url(#tile)"/>
  <rect x="26" y="26" width="460" height="460" rx="142" fill="url(#gloss)" opacity="0.5"/>
  <!-- yuqoridan yorug'lik -->
  <rect x="34" y="34" width="444" height="224" rx="128" fill="url(#shine)"/>
  <!-- ingichka shisha cheti -->
  <rect x="27.5" y="27.5" width="457" height="457" rx="140.5" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="3"/>
  <rect x="40" y="40" width="432" height="432" rx="128" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2"/>
  <g transform="translate(${t},${t}) scale(${scale.toFixed(6)}) translate(0,960)">
    <path d="${d}" fill="#ffffff"/>
  </g>
</svg>`;
}

fs.mkdirSync(OUT, { recursive: true });

let built = 0;
const missing = [];
for (const [name, [c1, c2]] of Object.entries(ICONS)) {
  const file = path.join(SRC, `${name}.svg`);
  if (!fs.existsSync(file)) {
    missing.push(name);
    continue;
  }
  const svg = fs.readFileSync(file, "utf8");
  const d = glyphPath(svg);
  if (!d) {
    missing.push(`${name} (path yo'q)`);
    continue;
  }
  const out = path.join(OUT, `${name}.png`);
  // eslint-disable-next-line no-await-in-loop
  await sharp(Buffer.from(glassSvg(d, c1, c2))).png({ compressionLevel: 9 }).toFile(out);
  built++;
  console.log("✅", name, "->", out);
}

console.log(`\nTayyor: ${built} ta ikonka.`);
if (missing.length) console.log("Yuklanmagan:", missing.join(", "));
