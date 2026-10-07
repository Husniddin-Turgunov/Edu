const L = `import { AdminTopProgress } from "@/components/admin/AdminTopProgress";

export default function Loading() {
  return <AdminTopProgress />;
}
`;

const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const dirs = [
  "src/app/admin/lms",
  "src/app/admin/jobs",
  "src/app/admin/onboarding",
  "src/app/admin/skills",
  "src/app/admin/videos",
  "src/app/admin/students",
  "src/app/admin/users",
  "src/app/admin/departments",
];
for (const d of dirs) {
  const f = path.join(ROOT, d, "loading.tsx");
  fs.writeFileSync(f, L, "utf8");
  console.log("yangilandi:", d + "/loading.tsx");
}
