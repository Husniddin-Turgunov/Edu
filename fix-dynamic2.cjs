const fs = require('fs');
const path = require('path');
function walk(d){let o=[];for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);if(e.isDirectory())o=o.concat(walk(p));else if(e.name==='route.ts')o.push(p)}return o}
const files=walk('src/app/api');
let fixed=0;
for(const f of files){
  let raw=fs.readFileSync(f,'utf8');
  // normalize CRLF -> LF for processing
  let c=raw.replace(/\r\n/g,'\n');
  // remove BOM
  c=c.replace(/^\uFEFF/,'');
  // remove ALL dynamic markers (any spacing)
  c=c.replace(/\n?export const dynamic = "force-dynamic";\r?/g,'');
  // trim leading blank lines
  c=c.replace(/^\n+/, '');
  // collapse 3+ newlines
  c=c.replace(/\n{3,}/g,'\n\n');
  const lines=c.split('\n');
  let lastImport=-1;
  lines.forEach((l,i)=>{ if(l.trim().startsWith('import ')) lastImport=i; });
  const marker = 'export const dynamic = "force-dynamic";';
  let next;
  if(lastImport>=0){ next = lines.slice(0,lastImport+1).join('\n')+'\n\n'+marker+'\n'+lines.slice(lastImport+1).join('\n'); }
  else { next = marker+'\n'+c; }
  // ensure exactly one trailing newline, write back with LF (prettier/next handle it)
  if(!next.endsWith('\n')) next+='\n';
  fs.writeFileSync(f,next);
  fixed++;
}
console.log('cleaned:'+fixed+'/'+files.length);
const sample=fs.readFileSync('src/app/api/admin/tests/route.ts','utf8').split('\n').slice(0,8).map((l,i)=>(i+1)+'|'+l).join('\n');
console.log(sample);
