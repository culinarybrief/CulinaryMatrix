import fs from 'node:fs/promises';
import path from 'node:path';
import Papa from 'papaparse';

const root = (...p:string[]) => path.join(process.cwd(), ...p);
type Row = Record<string,string>;
async function parseCsv(file:string): Promise<Row[]>{
  const txt = await fs.readFile(file,'utf8');
  const parsed = Papa.parse<Row>(txt, { header:true, skipEmptyLines:true });
  return (parsed.data||[]).filter(Boolean);
}
function score(lift:number, count:number){ return lift * Math.log(1+count); }

(async ()=>{
  const pairs = await parseCsv(root('data','stage','pairings.csv'));
  const items = pairs.map(r=>({
    a: r.a, b: r.b,
    a_id: r.a_id, b_id: r.b_id,
    count: Number(r.count||0),
    lift: Number(r.lift||1),
    cuisines: String(r.cuisines||'').split('|').filter(Boolean)
  }));

  const topOverall = [...items].sort((x,y)=> score(y.lift,y.count) - score(x.lift,x.count)).slice(0,50);

  const byCuisine = new Map<string, typeof items>();
  for (const it of items){
    for (const c of it.cuisines) {
      const arr = byCuisine.get(c) || [];
      arr.push(it);
      byCuisine.set(c, arr);
    }
  }
  const topByCuisine = Array.from(byCuisine.entries()).map(([c,arr])=>{
    const top = arr.sort((x,y)=> score(y.lift,y.count) - score(x.lift,x.count)).slice(0,30);
    return { cuisine: c, rows: top };
  });

  const outDir = root('data','report');
  await fs.mkdir(outDir, { recursive: true });
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Culinary Matrix — Top Pairings</title>
<style>
 body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;margin:24px;}
 h1,h2{margin:0 0 12px}
 table{border-collapse:collapse;width:100%;margin:12px 0}
 th,td{border:1px solid #e5e7eb;padding:8px 10px;font-size:14px}
 th{background:#f9fafb;text-align:left}
 .grid{display:grid;grid-template-columns:1fr;gap:24px}
 .pill{display:inline-block;background:#eef2ff;color:#3730a3;padding:2px 8px;border-radius:999px;font-size:12px;margin-right:6px}
 #q{padding:8px 10px;width:320px;border:1px solid #e5e7eb;border-radius:8px}
 .muted{color:#6b7280}
</style>
</head>
<body>
<h1>Culinary Matrix — Top Pairings</h1>
<input id="q" placeholder="Filter pairs by token…"/>
<section>
  <h2>Overall (top 50)</h2>
  ${renderTable(topOverall)}
</section>
<section>
  <h2>By Cuisine</h2>
  <div class="grid">
    ${topByCuisine.map(sec=>`<div><h3>${escape(sec.cuisine)}</h3>${renderTable(sec.rows)}</div>`).join('')}
  </div>
</section>
<script>
const q = document.getElementById('q');
q.addEventListener('input', ()=> {
  const term = q.value.trim().toLowerCase();
  document.querySelectorAll('tbody tr').forEach(tr=>{
    const text = tr.dataset.k || '';
    tr.style.display = !term || text.includes(term) ? '' : 'none';
  });
});
</script>
</body></html>`;
  await fs.writeFile(path.join(outDir,'index.html'), html, 'utf8');
  console.log('Wrote data/report/index.html');
})().catch(e=>{ console.error(e); process.exit(1); });

function renderTable(rows:any[]){
  return `<table><thead><tr><th>Pair</th><th class="muted">IDs</th><th>Count</th><th>Lift</th><th>Score</th><th>Cuisines</th></tr></thead><tbody>
${rows.map(r=>{
  const key = [r.a,r.b].join(' ').toLowerCase();
  return `<tr data-k="${escape(key)}"><td><strong>${escape(r.a)}</strong> + <strong>${escape(r.b)}</strong></td><td class="muted">${r.a_id} → ${r.b_id}</td><td>${r.count}</td><td>${Number(r.lift).toFixed(2)}</td><td>${(Number(r.lift)*Math.log(1+Number(r.count))).toFixed(2)}</td><td>${r.cuisines.map((c:string)=>`<span class='pill'>${escape(c)}</span>`).join('')}</td></tr>`;
}).join('')}
</tbody></table>`;
}
function escape(s:string){ return String(s||'').replace(/[&<>"]/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[m] as string)); }
