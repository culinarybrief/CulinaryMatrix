import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = (...p:string[]) => path.join(process.cwd(), ...p);
async function lineCount(p:string){
  const txt = await fs.readFile(p,'utf8').catch(()=> '');
  return txt.split(/\r?\n/).filter(Boolean).length;
}
(async ()=>{
  const outDir = root('data','jsonl');
  const manifestPath = path.join(outDir,'_manifest.json');

  const ingredients = await lineCount(path.join(outDir,'ingredients.jsonl'));
  const pairings    = await lineCount(path.join(outDir,'pairings.jsonl'));
  const edges       = await lineCount(path.join(outDir,'edges.jsonl'));

  const manifest = {
    generated_at: new Date().toISOString(),
    source_file: process.env.PAIR_MINE_SOURCE || null,
    params: {
      min_count: Number(process.env.PAIR_MINE_MIN_COUNT||''),
      top_n: Number(process.env.PAIR_MINE_TOP_N||''),
      allow_any: process.env.PAIR_ALLOW_ANY === '1'
    },
    counts: { ingredients, pairings, edges },
    files: {
      graph: 'data/jsonl/graph.jsonl',
      ingredients: 'data/jsonl/ingredients.jsonl',
      pairings: 'data/jsonl/pairings.jsonl',
      edges: 'data/jsonl/edges.jsonl'
    }
  };
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('Wrote', manifestPath);
})().catch(e=>{ console.error(e); process.exit(1); });
