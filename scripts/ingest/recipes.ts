import fs from 'node:fs/promises';
import path from 'node:path';
import Papa from 'papaparse';

type Recipe = { title?: string; ingredients: string[]|string; cuisine?: string };
const root = (...p:string[]) => path.join(process.cwd(), ...p);
const OUT = root('data','raw','onebatch.jsonl');

function normList(x: string[]|string): string[] {
  if (Array.isArray(x)) return x.map(s=>String(s).trim()).filter(Boolean);
  return String(x).split(/[\n,;]+/).map(s=>s.trim()).filter(Boolean);
}
function fp(r: Recipe): string {
  const t = (r.title||'').toLowerCase().trim();
  const ings = normList(r.ingredients).map(s=>s.toLowerCase()).sort().join('|');
  const c = (r.cuisine||'').toLowerCase().trim();
  return `${t}::${ings}::${c}`;
}
async function readExistingFingerprints(file:string){
  const fps = new Set<string>();
  try{
    const txt = await fs.readFile(file,'utf8');
    for (const line of txt.split(/\r?\n/)) {
      if(!line.trim()) continue;
      const r:Recipe = JSON.parse(line);
      fps.add(fp(r));
    }
  }catch{/* no existing */}
  return fps;
}
async function parseAny(p:string):Promise<Recipe[]>{
  const raw = await fs.readFile(p,'utf8');
  if (/\.jsonl$/i.test(p)) {
    return raw.split(/\r?\n/).filter(Boolean).map(l=>JSON.parse(l));
  }
  if (/\.json$/i.test(p)) {
    const j = JSON.parse(raw);
    return Array.isArray(j) ? j : (Array.isArray(j.recipes) ? j.recipes : []);
  }
  if (/\.csv$/i.test(p)) {
    const parsed = Papa.parse<Record<string,string>>(raw, { header:true, skipEmptyLines:true });
    return (parsed.data||[]).map(r=>({
      title: r.title || r.name,
      ingredients: r.ingredients || '',
      cuisine: r.cuisine
    }));
  }
  throw new Error(`Unsupported file type: ${p}`);
}

async function main(){
  const inputs = process.argv.slice(2);
  if (!inputs.length) {
    console.log('Usage: pnpm -s import:recipes <file1.jsonl|.json|.csv> [file2 ...]');
    process.exit(1);
  }

  await fs.mkdir(path.dirname(OUT), { recursive:true });
  const seen = await readExistingFingerprints(OUT);

  let added = 0, skipped = 0;
  const lines:string[] = [];
  for (const inPath of inputs){
    const abs = path.isAbsolute(inPath) ? inPath : root(inPath);
    const batch = await parseAny(abs);
    for (const r0 of batch){
      if (!r0 || !r0.ingredients) { skipped++; continue; }
      const rec:Recipe = {
        title: r0.title?.trim() || undefined,
        ingredients: normList(r0.ingredients),
        cuisine: r0.cuisine?.toString().trim().toLowerCase() || undefined
      };
      const key = fp(rec);
      if (seen.has(key)) { skipped++; continue; }
      lines.push(JSON.stringify(rec));
      seen.add(key);
      added++;
    }
  }
  if (lines.length) await fs.appendFile(OUT, lines.join('\n')+'\n', 'utf8');
  console.log(`Ingest complete → ${OUT}`);
  console.log(`Added: ${added}  Skipped (dupes/invalid): ${skipped}`);
}
main().catch(e=>{ console.error(e); process.exit(1); });
