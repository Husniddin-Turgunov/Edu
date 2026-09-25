const fs = require('fs');
const path = require('path');
function walk(d){let o=[];for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())o=o.concat(walk(p));else if(e.name==='route.ts')o.push(p)}return o}
const files=walk('src/app/api');
let n=0;
for(const f of files){
  const c=fs.readFileSync(f,'utf8');
  if(/export\s+const\s+dynamic/.test(c)) continue;
  const lines=c.split('\n');
  let idx=lines.findIndex(l=>l.trim().startsWith('import '));
  const marker = 'export const dynamic = "force-dynamic";';
  let next;
  if(idx>=0){ next = lines.slice(0,idx).join('\n')+'\n\n'+marker+'\n'+lines.slice(idx).join('\n'); }
  else { next = marker+'\n'+c; }
  fs.writeFileSync(f,next);
  n++;
}
console.log('patched:'+n+'/'+files.length);
