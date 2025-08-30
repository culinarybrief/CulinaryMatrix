import fs from 'node:fs/promises';
import path from 'node:path';
import { request } from 'undici';
import Papa from 'papaparse';
import qs from 'qs';
import 'dotenv/config';

const UA = process.env.USER_AGENT ?? 'CulinaryMatrix/1.0 (+https://culinarybrief.com; contact: hello@culinarybrief.com)';
const ALLOW_ANY = process.env.PAIR_ALLOW_ANY === '1';

type SrcCfg = { ingredients: { title: string }[]; techniques: { q: string }[] };
type Recipe = { id?: string|number; title?: string; ingredients: string[]|string; cuisine?: string|string[] };
type PairRow = { a: string; b: string; count: number; pmi: number; lift: number; cuisines?: string[] };

const root = (...p: string[]) => path.join(process.cwd(), ...p);

// ---------- IO ----------
async function writeCsv(file: string, rows: any[]) {
  await fs.mkdir(root('data','stage'), { recursive: true });
  const csv = Papa.unparse(rows);
  await fs.writeFile(root('data','stage', file), csv, 'utf8');
}
async function writeJson(file: string, data: any) {
  await fs.mkdir(path.dirname(root(file)), { recursive: true });
  await fs.writeFile(root(file), JSON.stringify(data, null, 2), 'utf8');
}

// ---------- Helpers ----------
const slug = (s:string)=> s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const titleCase = (s:string)=> s.replace(/\w\S*/g, t=>t[0].toUpperCase()+t.slice(1).toLowerCase());
function guessGroceryCategory(cats:string[]){
  if (cats.some(c=>/spices?|herbs?/i.test(c))) return 'spices-herbs';
  if (cats.some(c=>/vegetables?/i.test(c))) return 'produce';
  if (cats.some(c=>/fruit/i.test(c))) return 'produce';
  return undefined;
}

// ---------- Sources ----------
async function fetchWikipediaSummary(title: string) {
  const params = qs.stringify({ action:'query', prop:'extracts|categories', exintro:1, explaintext:1, format:'json', titles:title });
  const url = `https://en.wikipedia.org/w/api.php?${params}`;
  const res = await request(url, { headers:{ 'user-agent': UA, 'accept':'application/json' }});
  const json = await res.body.json();
  const pages = json?.query?.pages || {};
  const page = Object.values(pages)[0] as any;
  const extract = page?.extract as string | undefined;
  const categories = (page?.categories || []).map((c:any)=>String(c.title||'').replace('Category:',''));
  return { title, extract, categories, source_url:`https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`, source_name:'Wikipedia', license:'CC BY-SA 4.0' };
}
async function queryWikidataAliases(labels:string[]) {
  if (!labels.length) return [];
  const values = labels.map(l=>`"${l}"@en`).join(' ');
  const sparql = `
    SELECT ?item ?itemLabel ?alias WHERE {
      VALUES ?label { ${values} }
      ?item rdfs:label ?label.
      OPTIONAL { ?item skos:altLabel ?alias FILTER(LANG(?alias)='en') }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }`;
  const url = 'https://query.wikidata.org/sparql';
  const res = await request(url, { method:'POST', headers:{
    'user-agent': UA, 'accept':'application/sparql-results+json', 'content-type':'application/sparql-query'
  }, body:sparql });
  const json = await res.body.json();
  const rows = json?.results?.bindings || [];
  const byItem:Record<string,{label:string, aliases:Set<string>}> = {};
  for (const r of rows) {
    const id = r.item.value.split('/').pop()!;
    const label = r.itemLabel?.value || '';
    const alias = r.alias?.value;
    if (!byItem[id]) byItem[id] = { label, aliases:new Set() };
    if (alias) byItem[id].aliases.add(alias);
  }
  return Object.entries(byItem).map(([id,v])=>({ id, label:v.label, aliases:[...v.aliases], source_name:'Wikidata', license:'CC0', source_url:`https://www.wikidata.org/wiki/${id}` }));
}


// ---------- Normalizers ----------
function toIngredient(arg:{title:string; extract?:string; categories?:string[]; source_url:string; source_name:string; license:string}){
  const { title, extract, categories=[], source_url, source_name, license } = arg;
  return {
    id: slug(title),
    name: title,
    aliases: undefined as string[]|undefined,
    cuisines: categories.filter(c=>/cuisine/i.test(c)).map(c=>c.replace(/ cuisine/i,'')),
    grocery_category: guessGroceryCategory(categories),
    seasonality: undefined as string[]|undefined,
    _provenance: { source_url, source_name, license, summary: extract?.slice(0,280) }
  };
}

// ---------- Pair mining ----------
function normTok(s:string){
  return s.toLowerCase()
    .replace(/[^a-z0-9\s-]/g,' ')
    .replace(/\b(of|and|fresh|chopped|minced|optional|to|taste)\b/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function tokenizeIngredients(input:string|string[]):string[]{
  if (Array.isArray(input)) return input.map(normTok).filter(Boolean);
  return input.split(/[\n,;]+/).map(normTok).filter(Boolean);
}
async function loadRecipesFromFile(filePath:string):Promise<Recipe[]>{
  const abs = path.isAbsolute(filePath) ? filePath : root(filePath);
  const raw = await fs.readFile(abs,'utf8');
  if (/\.jsonl$/i.test(abs)) return raw.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
  if (/\.json$/i.test(abs))  return JSON.parse(raw);
  if (/\.csv$/i.test(abs)) {
    const [header, ...rows] = raw.split(/\r?\n/).filter(Boolean);
    const cols = header.split(',').map(h=>h.trim());
    const iIdx = cols.indexOf('ingredients');
    const cIdx = cols.indexOf('cuisine');
    return rows.map(line=>{
      const cells = line.split(',');
      return { ingredients: cells[iIdx]||'', cuisine: cIdx>=0 ? cells[cIdx] : undefined } as Recipe;
    });
  }
  throw new Error(`Unsupported file type: ${abs}`);
}
function minePairs(recipes:Recipe[], opts:{ whitelist?:Set<string>; minCount?:number; topN?:number; cuisineAware?:boolean }={}):PairRow[]{
  const { whitelist, minCount=5, topN=5000, cuisineAware=true } = opts;
  const itemFreq = new Map<string,number>();
  const pairFreq = new Map<string,number>();
  const pairCuis = new Map<string, Set<string>>();
  let docs = 0;

  for (const r of recipes){
    let toks = tokenizeIngredients(r.ingredients);
    if (whitelist && !ALLOW_ANY) toks = toks.filter(t=>whitelist.has(slug(t)));
    const uniq = [...new Set(toks)];
    if (uniq.length < 2) continue;
    docs++;
    for (const t of uniq) itemFreq.set(t, (itemFreq.get(t)||0)+1);
    for (let i=0;i<uniq.length;i++) for (let j=i+1;j<uniq.length;j++){
      const a = uniq[i] < uniq[j] ? uniq[i] : uniq[j];
      const b = uniq[i] < uniq[j] ? uniq[j] : uniq[i];
      const key = `${a}|||${b}`;
      pairFreq.set(key, (pairFreq.get(key)||0)+1);
      if (cuisineAware && r.cuisine){
        const set = pairCuis.get(key) || new Set<string>();
        const cs = Array.isArray(r.cuisine) ? r.cuisine : [r.cuisine];
        cs.filter(Boolean).forEach(c=>set.add(String(c).toLowerCase()));
        pairCuis.set(key, set);
      }
    }
  }

  const rows:PairRow[] = [];
  for (const [key,cAB] of pairFreq){
    if (cAB < minCount) continue;
    const [a,b] = key.split('|||');
    const cA = itemFreq.get(a) || 1;
    const cB = itemFreq.get(b) || 1;
    const pA = cA / docs, pB = cB / docs, pAB = cAB / docs;
    const pmi = Math.log2(pAB / (pA*pB));
    const lift = pAB / (pA*pB);
    rows.push({ a, b, count:cAB, pmi, lift, cuisines:[...(pairCuis.get(key)||new Set())] });
  }
  rows.sort((x,y)=> (y.pmi*Math.log2(1+y.count)) - (x.pmi*Math.log2(1+x.count)));
  return rows.slice(0, topN);
}


// ---------- Main ----------
async function main(){
  const cfg:SrcCfg = JSON.parse(await fs.readFile(root('scripts/scrape/sources.json'),'utf8'));

  // 1) Seed ingredients from Wikipedia
  const wiki = await Promise.all(cfg.ingredients.map(i=>fetchWikipediaSummary(i.title)));
  const ingredients = wiki.map(toIngredient);

  // 2) Enrich aliases from Wikidata
  const wd = await queryWikidataAliases(cfg.ingredients.map(i=>i.title));
  const bySlug = new Map(ingredients.map(i=>[i.id,i]));
  for (const row of wd){
    const s = slug(row.label.toLowerCase());
    const hit = bySlug.get(s);
    if (hit){
      hit.aliases = Array.from(new Set([...(hit.aliases||[]), ...row.aliases]));
      (hit as any)._wikidata = { id: row.id, source_url: row.source_url };
    }
  }

  // 3) Techniques (seed list)
  const techniques:any[] = cfg.techniques.map(t=>({ id: t.q, name: t.q }));

  // 4) Pair mining
  const pairSrc = process.env.PAIR_MINE_SOURCE;
  let pairings:any[] = [];
  if (pairSrc){
    const whitelist = new Set(ingredients.map(i=>i.id)); // slugs
    const recipes = await loadRecipesFromFile(pairSrc);
    const mined = minePairs(recipes, {
      whitelist,
      minCount: parseInt(process.env.PAIR_MINE_MIN_COUNT || '5',10),
      topN: parseInt(process.env.PAIR_MINE_TOP_N || '5000',10),
      cuisineAware: true
    });

    // Convert to ID-based + collect discovered tokens
    const discovered = new Set<string>();
    pairings = mined.map(r=>{
      const a_id = slug(r.a), b_id = slug(r.b);
      if (!bySlug.has(a_id)) discovered.add(r.a);
      if (!bySlug.has(b_id)) discovered.add(r.b);
      return {
        a_id, b_id,
        a: r.a, b: r.b,
        count: r.count,
        pmi: +r.pmi.toFixed(4),
        lift: +r.lift.toFixed(4),
        cuisines: r.cuisines?.join('|') || undefined
      };
    });

    // Auto-add discovered ingredients so joins are clean
    for (const name of discovered){
      const id = slug(name);
      if (bySlug.has(id)) continue;
      const ing = {
        id,
        name: titleCase(name),
        aliases: undefined as string[]|undefined,
        cuisines: undefined as string[]|undefined,
        grocery_category: undefined as string|undefined,
        seasonality: undefined as string[]|undefined,
        _provenance: {
          source_name: 'Corpus',
          source_url: String(pairSrc),
          license: 'Derived',
          summary: 'Discovered from recipe corpus (auto-added).'
        }
      };
      ingredients.push(ing);
      bySlug.set(id, ing);
    }
  }

  // 5) Write stage CSVs
  await writeCsv('ingredients.csv', ingredients.map(({_provenance, ...rest})=>rest));
  await writeCsv('techniques.csv', techniques);
  await writeCsv('pairings.csv', pairings);
  await writeCsv('edges.csv', []);

  // 6) Final JSON
  const matrix:any = {
    version: '2.0.0',
    generated_at: new Date().toISOString(),
    ingredients, techniques, pairings, edges: []
  };
  await writeJson('data/matrix.v2.json', matrix);

  console.log('Scrape complete → data/stage/*.csv & data/matrix.v2.json');
}
main().catch(e=>{ console.error(e); process.exit(1); });
