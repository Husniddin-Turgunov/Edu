// /start sahifasidan 1-qadam formasi olib tashlangandan keyin qolgan
// ishlatilmaydigan kodni tozalaydi (o'lik state, handler va ikonkalar).
const fs = require("fs");
const path = require("path");
const F = path.join(__dirname, "..", "src", "app", "start", "page.tsx");

let src = fs.readFileSync(F, "utf8");
let lines = src.split(/\r?\n/);

// 1) Ikonkalarni import ro'yxatidan olib tashlaymiz
const deadIcons = [
  "ArrowRight", "Building2", "CheckCircle2", "Eye", "EyeOff",
  "Loader2", "Lock", "Mail", "Phone", "ShieldCheck", "User", "UserPlus",
];
const iconRe = /^import \{([\s\S]*?)\} from "lucide-react";$/;
lines = lines.map((l) => {
  const m = l.match(iconRe);
  if (!m) return l;
  const names = m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((n) => !deadIcons.includes(n));
  if (names.length === 0) return null; // import butunlay olib tashlandi
  return `import { ${names.join(", ")} } from "lucide-react";`;
}).filter((l) => l !== null);

// 2) Ishlatilmaydigan state va handler'larni butun qatorlari bo'yicha o'chiramiz
const deadPatterns = [
  /^\s*const \[showPassword, setShowPassword\] = useState/,
  /^\s*const \[error, setError\] = useState/,
  /^\s*const \[success, setSuccess\] = useState/,
  /^\s*const \[loading, setLoading\] = useState/,
  /^\s*const \[regOpen, setRegOpen\] = useState/,
  /^\s*const \[departments, setDepartments\] = useState/,
  /^\s*const \[deptsLoading, setDeptsLoading\] = useState/,
  /^\s*const selectedDept = useMemo\(/,
  /^\s*const set = \(k: keyof typeof form\)/,
  /^\s*const handleSubmit = async /,
  /^\s*useEffect\(\(\) => \{$/, // faqat ichida fetch(/api/registration bo'lsa
];

const before = lines.length;
lines = lines.filter((l, i, arr) => {
  for (const re of deadPatterns) {
    if (re.test(l)) {
      // useEffect va useMemo bloklarini oxirigacha o'chiramiz
      if (re.source.includes("useEffect")) {
        // keyingi "}, [deps])" qatorini topamiz
        for (let j = i + 1; j < arr.length; j++) {
          arr[j] = "__DELETE__";
          if (/^\s*\}, \[/.test(arr[j])) break;
        }
        return false;
      }
      if (re.source.includes("useMemo")) {
        for (let j = i + 1; j < arr.length; j++) {
          arr[j] = "__DELETE__";
          if (/\}\);?\s*$/.test(arr[j]) && /^\s*\}\)/.test(arr[j])) break;
          if (/\}\), \[/.test(arr[j])) break;
        }
        return false;
      }
      return false;
    }
  }
  return true;
});
lines = lines.filter((l) => l !== "__DELETE__");

src = lines.join("\n");
fs.writeFileSync(F, src, "utf8");
console.log(`${before} -> ${lines.length} qator`);
