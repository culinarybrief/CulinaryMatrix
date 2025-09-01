import fs from 'fs';

const ING_PATH = 'public/data/jsonl/ingredients.jsonl';
const PAIR_PATH = 'public/data/jsonl/pairings.jsonl';
const REC_PATH  = 'public/data/raw/onebatch.jsonl'; // optional

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/suggest.mjs <ingredient1> [ingredient2 ...] [--cuisine=mediterranean] [--top=10]');
  process.exit(1);
}
const cuisineArg = args.find(a => a.startsWith('--cuisine='));
const topArg     = args.find(a => a.startsWith('--top='));
const wanted     = args.filter(a => !a.startsWith('--')).map(s => s.toLowerCase());
const cuisine    = cuisineArg ? cuisineArg.split('=')[1] : null;
const TOPN       = topArg ? parseInt(topArg.split('=')[1],10) : 10;

function readJSONL(path) {
  if (!fs.existsSync(path)) return [];
  return fs.readFileSync(path,'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
}
const pairs = readJSONL(PAIR_PATH);

// build scores for candidates connected to any wanted ingredient
const score = new Map();
for (const p of pairs) {
  const A = (p.a_id || p.a || '').toLowerCase();
  const B = (p.b_id || p.b || '').toLowerCase();
  if (!A || !B) continue;
  const consider = [];
  if (wanted.includes(A)) consider.push(B);
  if (wanted.includes(B)) consider.push(A);
  for (const c of consider) {
    const base = (p.lift ?? 0) * 2 + (p.pmi ?? 0); // simple composite
    const bonus = cuisine && (p.cuisines || '').toLowerCase().includes(cuisine.toLowerCase()) ? 1 : 0;
    score.set(c, (score.get(c) || 0) + base + bonus);
  }
}

// rank candidates, remove already-wanted
const ranked = [...score.entries()]
  .filter(([ing]) => !wanted.includes(ing))
  .sort((a,b) => b[1]-a[1])
  .slice(0, TOPN)
  .map(([ingredient, s]) => ({ ingredient, score: +s.toFixed(3) }));

// optional: find recipes that match >=2 of [wanted + top suggestions]
const chosenSet = new Set([...wanted, ...ranked.slice(0,5).map(r=>r.ingredient)]);
const recipes = readJSONL(REC_PATH);
const matches = recipes.map(r => {
  const ings = (r.ingredients||[]).map(i=>i.toLowerCase());
  const overlap = ings.filter(i => chosenSet.has(i)).length;
  return { title: r.title || r.name || r.id, overlap, ingredients: ings, cuisine: r.cuisine || '' };
}).filter(x => x.overlap >= 2)
  .sort((a,b) => b.overlap - a.overlap)
  .slice(0, 10);

console.log(JSON.stringify({
  input: wanted, cuisine: cuisine || null,
  suggestions: ranked,
  recipe_matches: matches
}, null, 2));
