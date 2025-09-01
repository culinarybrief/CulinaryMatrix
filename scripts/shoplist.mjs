import fs from 'fs';

const REC_PATH  = 'public/data/raw/onebatch.jsonl';
const PANTRY    = 'public/data/jsonl/pantry.ignore.txt';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/shoplist.mjs --titles="Title A|Title B|Title C"');
  process.exit(1);
}
const titlesArg = args.find(a=>a.startsWith('--titles='));
const titles = titlesArg ? titlesArg.split('=')[1].split('|').map(s=>s.trim().toLowerCase()) : [];

function readJSONL(path) {
  if (!fs.existsSync(path)) return [];
  return fs.readFileSync(path,'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l));
}
function readPantry(path) {
  if (!fs.existsSync(path)) return new Set();
  return new Set(fs.readFileSync(path,'utf8').split(/\r?\n/).map(s=>s.trim().toLowerCase()).filter(Boolean));
}

const recipes = readJSONL(REC_PATH);
const pantry = readPantry(PANTRY);

const chosen = recipes.filter(r => titles.includes((r.title||r.name||r.id||'').toLowerCase()));
const items = new Map();

for (const r of chosen) {
  for (const ing of (r.ingredients||[])) {
    const key = String(ing).toLowerCase();
    if (pantry.has(key)) continue;
    items.set(key, (items.get(key)||0) + 1);
  }
}

const list = [...items.entries()]
  .sort((a,b)=> b[1]-a[1])
  .map(([ingredient,count]) => ({ ingredient, count }));

console.log(JSON.stringify({ selected: titles, items: list }, null, 2));
