import fs from 'node:fs/promises';
import path from 'node:path';
import Papa from 'papaparse';

const root = (...p:string[]) => path.join(process.cwd(), ...p);
const slug = (s:string)=> s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

type Row = Record<string,string>;
async function parseCsv(file:string): Promise<Row[]> {
  const txt = await fs.readFile(file,'utf8').catch(()=> '');
  if (!txt) return [];
  const parsed = Papa.parse<Row>(txt, { header:true, skipEmptyLines:true });
  return (parsed.data||[]).filter(Boolean);
}

(async ()=>{
  const ingredients = await parseCsv(root('data','stage','ingredients.csv'));
  const pairs       = await parseCsv(root('data','stage','pairings.csv'));

  // active = ingredients that appear as a_id in pairings (edges go Ingredient -> Pairing)
  const active = new Set<string>();
  const haveIds = pairs.length && ('a_id' in pairs[0]);
  for (const r of pairs) {
    const id = haveIds ? String(r.a_id||'') : slug(String(r.a||''));
    if (id) active.add(id);
  }

  const activeIngs = ingredients
    .map(r => ({ id: String(r.id||slug(String(r.name||''))), name: String(r.name||''), category: r.grocery_category || r.category, default_cuisine: (r as any).cuisines || (r as any).default_cuisine }))
    .filter(r => active.has(r.id))
    .sort((a,b)=> a.id.localeCompare(b.id));

  const outDir = root('data','jsonl');
  await fs.mkdir(outDir,{recursive:true});
  const lines = activeIngs.map(o => JSON.stringify({ Ingredient: { id:o.id, name:o.name, category:o.category||undefined, default_cuisine:o.default_cuisine||undefined } })).join('\n')+'\n';
  await fs.writeFile(path.join(outDir,'ingredients.dropdown.jsonl'), lines, 'utf8');

  console.log(`Wrote data/jsonl/ingredients.dropdown.jsonl (${activeIngs.length} active ingredients)`);
})();
