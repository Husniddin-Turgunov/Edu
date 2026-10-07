import fs from "fs";
import path from "path";
import { GLASS_DEFAULTS, sanitizeGlass, type GlassSettings } from "@/lib/liquid-glass-settings";

function file() {
  return path.join(process.cwd(), "src", "data", "liquid-glass.json");
}

export function getGlassSettings(): GlassSettings {
  try {
    return sanitizeGlass(JSON.parse(fs.readFileSync(file(), "utf8")));
  } catch {
    return { ...GLASS_DEFAULTS };
  }
}

export function saveGlassSettings(input: unknown): GlassSettings {
  const next = sanitizeGlass(input);
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(next, null, 2), "utf8");
  return next;
}
