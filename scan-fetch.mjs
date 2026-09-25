import fs from 'fs';
import path from 'path';
function walk(d, out=[]) { for (const e of fs.readdirSync(d, {withFileTypes:true})) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else if (/\.(tsx|ts)$/.test(e.name)) out.push(p); } return out; }
const files = [...walk('src/app'), ...walk('src/components'), ...walk('src/hooks')];
let n = 0;
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((l, i) => {
    if (/fetch\(\s*[`"']\/api\//.test(l) && !l.includes('no-store') && !l.includes('method:')) {
      // keyingi 3 qatorda method bo'lsa POST/PATCH/DELETE — u keshlanmaydi, o'tkazib yuboramiz
      const ctx = lines.slice(i, i+3).join(' ');
      if (/method:\s*["'](POST|PATCH|PUT|DELETE)["']/.test(ctx)) return;
      n++;
      console.log(`${f.replace(/\\/g,'/')}:${i+1}  ${l.trim().slice(0,120)}`);
    }
  });
}
console.log('---\nJami no-store siz GET fetch:', n);
