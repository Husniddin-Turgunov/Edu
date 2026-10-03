// Bitrix KB: barcha maqola ID larini HTML dan chiqaradi.
const fs = require("fs");
const s = fs.readFileSync("bitrix-kb.html", "utf8");
console.log("HTML hajmi:", s.length);

const opens = [...new Set([...s.matchAll(/href="\/open\/(\d+)\/?"/g)].map((m) => m[1]))];
console.log("maqola ID soni:", opens.length);
console.log("birinchi 20:", opens.slice(0, 20).join(", "));

// bo'lim kodlari (rasm yo'llaridagi)
const codes = [...new Set([...s.matchAll(/\/images\/helpdesk\/screenshots\/ru\/([^/"]+)\//g)].map((m) => m[1]))];
console.log("\nbo'lim kodi (rasm yo'llaridan):", codes.length);
codes.slice(0, 30).forEach((c) => console.log("  ", c));
