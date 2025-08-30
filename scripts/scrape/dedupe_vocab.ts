import fs from 'node:fs/promises';
import path from 'node:path';
import Papa from 'papaparse';

const root = (...p:string[]) => path.join(process.cwd(), ...p);
const slug = (s:string)=> s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

type Row = Record<string,string>;
async function parseCsv(file:string): Promise<Row[]> {
  const txt = await fs.readFile(file, 'utf8');
  const parsed = Papa.parse<Row>(txt, { header:true, skipEmptyLines:true });
  return (parsed.data||[]).filter(Boolean);
}
function toCsv(rows:Row[]):string {
  return Papa.unparse(rows);
}

function singular(n:string){
  if (n.endsWith('ies')) return n.slice(0,-3)+'y';
  if (n.endsWith('oes')) return n.slice(0,-2);
  if (n.endsWith('ses')) return n.slice(0,-2);
  if (n.endsWith('s') && !n.endsWith('ss')) return n.slice(0,-1);
  return n;
}
function canonToken(name:string, alias:Record<string,string>){
  const n = name.toLowerCase().trim();
  const s = singular(n);
  return alias[n] || alias[s] || s;
}

(async ()=>{
  const pairPath = root('data','stage','pairings.csv');
  const exists = await fs.stat(pairPath).catch(()=>null);
  if(!exists){ console.log('No pairings.csv found, skipping'); process.exit(0); }

  const rows = await parseCsv(pairPath);
  const aliasPath = root('data','config','aliases.json');
  const alias = JSON.parse(await fs.readFile(aliasPath,'utf8').catch(()=> '{}')) as Record<string,string>;

  // normalize + merge
  type Key = string;
  const merged = new Map<Key, {a_id:string;b_id:string;a:string;b:string;count:number;pmi:number;lift:number;cuis:Set<string>}>();

  for (const r of rows){
    const aName = (r as any).a || (r as any).a_id?.replace(/-/g,' ') || '';
    const bName = (r as any).b || (r as any).b_id?.replace(/-/g,' ') || '';
    const aC = canonToken(aName, alias);
    const bC = canonToken(bName, alias);

    // order pair deterministically
    const [A,B] = aC < bC ? [aC,bC] : [bC,aC];

    const A_id = slug(A), B_id = slug(B);
    const key = `${A_id}|||${B_id}`;

    const count = Number(r.count||0) || 0;
    const pmi   = Number(r.pmi||0)   || 0;
    const lift  = Number(r.lift||0)  || 1;
    const cuisines = String(r.cuisines||'').split('|').map(s=>s.trim()).filter(Boolean);

    const cur = merged.get(key) || { a_id:A_id, b_id:B_id, a:A, b:B, count:0, pmi:0, lift:1, cuis:new Set<string>() };
    cur.count += count || 1;                    // sum counts
    cur.pmi    = Math.max(cur.pmi, pmi);        // keep strongest pmi
    cur.lift   = Math.max(cur.lift, lift);      // keep strongest lift
    cuisines.forEach(c=>cur.cuis.add(c));
    merged.set(key, cur);
  }

  const out = Array.from(merged.values()).map(v=>({
    a_id: v.a_id, b_id: v.b_id, a: v.a, b: v.b,
    count: v.count, pmi: +v.pmi.toFixed(4), lift: +v.lift.toFixed(4),
    cuisines: Array.from(v.cuis).join('|') || undefined
  }));

  // sort by ingredient_id then pairing_id
  out.sort((x,y)=> x.a_id.localeCompare(y.a_id) || x.b_id.localeCompare(y.b_id));

  await fs.writeFile(pairPath, toCsv(out), 'utf8');
  console.log(`Deduped ${rows.length} → ${out.length} rows. Updated ${pairPath}`);
})().catch(e=>{ console.error(e); process.exit(1); });
