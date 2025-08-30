import fs from 'node:fs/promises';
import path from 'node:path';
import Papa from 'papaparse';

const root = (...p:string[]) => path.join(process.cwd(), ...p);
const slug = (s:string)=> s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const titleCase = (s:string)=> s.replace(/\w\S*/g, t=>t[0].toUpperCase()+t.slice(1).toLowerCase());

type Row = Record<string,string>;
async function parseCsv(file:string): Promise<Row[]> {
  const txt = await fs.readFile(file, 'utf8');
  const parsed = Papa.parse<Row>(txt, { header: true, skipEmptyLines: true });
  return (parsed.data || []).filter(Boolean);
}

/** heuristics */
const HERBS = new Set(['basil','cilantro','parsley','mint','dill','oregano','thyme','rosemary','chive','tarragon','sage']);
const SPICES = new Set(['cumin','coriander','paprika','turmeric','chili powder','black pepper','cinnamon','clove','nutmeg','cardamom']);
const ACIDS = new Set(['lemon','lime','vinegar','balsamic vinegar','red wine vinegar','rice vinegar','yuzu','lemon juice','lime juice']);
const FATS = new Set(['olive oil','butter','cream','yogurt','ghee','lard','mayonnaise','olive','avocado oil','sesame oil']);
const SAUCES = new Set(['soy sauce','fish sauce','hot sauce','tahini','salsa','pesto','teriyaki','hoisin','barbecue sauce']);
const AROMATICS = new Set(['onion','garlic','ginger','shallot','scallion','leek','celery','carrot']);
const CHEESES = new Set(['feta','parmesan','mozzarella','cheddar','goat cheese','ricotta','pecorino','gruyere','blue cheese']);
const TEXTURES = new Set(['croutons','panko','breadcrumbs','nuts','seeds']);

const PROTEINS = new Set(['chicken','beef','pork','lamb','shrimp','salmon','tuna','egg','eggs','turkey','tofu','tempeh']);
const LEGUMES  = new Set(['black beans','kidney beans','chickpea','chickpeas','lentil','lentils','peas','edamame']);
const CARBS    = new Set(['rice','quinoa','bread','pasta','noodles','tortilla','potato','potatoes','couscous','bulgur']);
const VEG      = new Set(['onion','tomato','garlic','cucumber','spinach','kale','lettuce','arugula','bell pepper','mushroom','zucchini','eggplant','broccoli','cauliflower','cabbage','carrot','celery','basil','cilantro','parsley']);

const DAIRY_WORDS = new Set(['yogurt','butter','cream','cheese','feta','parmesan','mozzarella','cheddar','milk']);
const NUT_WORDS   = new Set(['almond','walnut','pecan','hazelnut','peanut','cashew','pistachio','nuts']);
const SHELLFISH   = new Set(['shrimp','prawn','crab','lobster','oyster','scallop','mussel','clam']);
const SOY_WORDS   = new Set(['soy','soy sauce','tofu','edamame','tamari']);
const EGG_WORDS   = new Set(['egg','eggs']);
const WHEAT_WORDS = new Set(['flour','bread','panko','breadcrumbs','pasta']);

function inferIngredientCategory(name:string): 'protein'|'veg'|'carb'|'legume'|'other' {
  const n = name.toLowerCase();
  if (PROTEINS.has(n)) return 'protein';
  if (LEGUMES.has(n))  return 'legume';
  if (CARBS.has(n))    return 'carb';
  if (VEG.has(n))      return 'veg';
  return 'other';
}
function inferPairingType(name:string): 'herb'|'spice'|'acid'|'fat'|'sauce'|'aromatic'|'texture'|'cheese'|'other' {
  const n = name.toLowerCase();
  if (HERBS.has(n)) return 'herb';
  if (SPICES.has(n)) return 'spice';
  if (ACIDS.has(n)) return 'acid';
  if (FATS.has(n)) return 'fat';
  if (SAUCES.has(n)) return 'sauce';
  if (AROMATICS.has(n)) return 'aromatic';
  if (TEXTURES.has(n)) return 'texture';
  if (CHEESES.has(n)) return 'cheese';
  return 'other';
}
function inferAllergens(name:string): string[] {
  const n = name.toLowerCase();
  const tags = new Set<string>();
  for (const w of DAIRY_WORDS) if (n.includes(w)) tags.add('dairy');
  for (const w of NUT_WORDS)   if (n.includes(w)) tags.add('nuts');
  for (const w of SHELLFISH)   if (n.includes(w)) tags.add('shellfish');
  for (const w of SOY_WORDS)   if (n.includes(w)) tags.add('soy');
  for (const w of EGG_WORDS)   if (n.includes(w)) tags.add('egg');
  for (const w of WHEAT_WORDS) if (n.includes(w)) tags.add('wheat');
  return [...tags];
}
function strengthFromLift(lift:number): 1|2|3|4|5 {
  if (lift >= 8)    return 5;
  if (lift >= 4)    return 4;
  if (lift >= 2)    return 3;
  if (lift >= 1.25) return 2;
  return 1;
}

async function main(){
  const ingRows  = await parseCsv(root('data','stage','ingredients.csv')); // id,name,...
  const pairRows = await parseCsv(root('data','stage','pairings.csv'));   // a_id,b_id,a,b,count,pmi,lift,cuisines (or a,b,...)
  await parseCsv(root('data','stage','techniques.csv')); // not used per-edge yet

  // Ensure IDs exist for pairs (works with either schema)
  const haveIds = pairRows.length && ('a_id' in pairRows[0]) && ('b_id' in pairRows[0]);
  for (const r of pairRows) {
    if (!haveIds) {
      (r as any).a_id = slug(String(r.a||''));
      (r as any).b_id = slug(String(r.b||''));
    }
  }

  // Cuisine inference from pairings
  const cuisineCountByToken = new Map<string, Map<string, number>>();
  for (const r of pairRows) {
    const cuisines = String(r.cuisines||'').split('|').map(s=>s.trim()).filter(Boolean);
    const tokens = [String((r as any).a||''), String((r as any).b||'')].map(s=>s.toLowerCase()).filter(Boolean);
    for (const t of tokens) {
      const m = cuisineCountByToken.get(t) || new Map<string,number>();
      for (const c of cuisines) m.set(c, (m.get(c)||0)+1);
      cuisineCountByToken.set(t, m);
    }
  }
  const topCuisine = (token:string): string|undefined => {
    const m = cuisineCountByToken.get(token.toLowerCase());
    if (!m) return undefined;
    let best:string|undefined, bestN = 0;
    for (const [c,n] of m) if (n>bestN) { best=c; bestN=n; }
    return best;
  };

  // Build Ingredients (dedup + auto-add from pairings) and sort
  const ingredientIds = new Set<string>();
  const ingredients: any[] = [];
  for (const r of ingRows) {
    const id = String(r.id || slug(String(r.name||'')));
    const name = String(r.name || id);
    if (ingredientIds.has(id)) continue;
    ingredientIds.add(id);
    ingredients.push({
      Ingredient: {
        id,
        name,
        category: inferIngredientCategory(name),
        default_cuisine: topCuisine(name),
        notes: undefined
      }
    });
  }
  const seenTokens = new Set<string>();
  for (const r of pairRows) {
    const a = String((r as any).a||''); const b = String((r as any).b||'');
    if (a) seenTokens.add(a.toLowerCase());
    if (b) seenTokens.add(b.toLowerCase());
  }
  for (const tok of seenTokens) {
    const id = slug(tok);
    if (!ingredientIds.has(id)) {
      ingredientIds.add(id);
      const name = titleCase(tok);
      ingredients.push({
        Ingredient: {
          id,
          name,
          category: inferIngredientCategory(name),
          default_cuisine: topCuisine(name),
          notes: 'Auto-added from corpus'
        }
      });
    }
  }
  ingredients.sort((a,b)=> a.Ingredient.id.localeCompare(b.Ingredient.id));

  // Build Pairings (dedup by id) and sort
  const pairingIds = new Set<string>();
  const pairings: any[] = [];
  const HERB_SPICE_ACID = new Set(['herb','spice','acid']);
  const addPairing = (id:string, name:string) => {
    if (pairingIds.has(id)) return;
    pairingIds.add(id);
    const type = inferPairingType(name);
    const allergens = inferAllergens(name);
    const nutrition_tags: string[] = [];
    if (HERB_SPICE_ACID.has(type)) nutrition_tags.push('plant-forward');
    pairings.push({
      Pairing: {
        id, name, type,
        nutrition_tags,
        allergens: allergens.length? allergens : undefined
      }
    });
  };
  for (const r of pairRows) {
    const a_id = String((r as any).a_id); const b_id = String((r as any).b_id);
    const aName = String((r as any).a || a_id); const bName = String((r as any).b || b_id);
    addPairing(a_id, aName);
    addPairing(b_id, bName);
  }
  pairings.sort((a,b)=> a.Pairing.id.localeCompare(b.Pairing.id));

  // Build Edges and sort
  const edges: any[] = [];
  for (const r of pairRows) {
    const a_id = String((r as any).a_id);
    const b_id = String((r as any).b_id);
    const lift = Number(r.lift || 1);
    const cuisines = String(r.cuisines||'').split('|').map(s=>s.trim()).filter(Boolean);
    const strength = (():1|2|3|4|5=> {
      if (lift >= 8) return 5;
      if (lift >= 4) return 4;
      if (lift >= 2) return 3;
      if (lift >= 1.25) return 2;
      return 1;
    })();
    edges.push({
      Edge: {
        ingredient_id: a_id,
        pairing_id: b_id,
        strength,
        cuisines: cuisines.length? cuisines : undefined,
        techniques: []
      }
    });
  }
  edges.sort((x,y)=> {
    const ai = x.Edge.ingredient_id.localeCompare(y.Edge.ingredient_id);
    if (ai) return ai;
    return x.Edge.pairing_id.localeCompare(y.Edge.pairing_id);
  });

  // Write outputs (+ combined, ordered: Ingredients → Pairings → Edges)
  const outDir = root('data','jsonl');
  await fs.mkdir(outDir, { recursive: true });
  const toLines = (arr:any[]) => arr.map(o=>JSON.stringify(o)).join('\n')+'\n';
  await fs.writeFile(path.join(outDir,'ingredients.jsonl'), toLines(ingredients), 'utf8');
  await fs.writeFile(path.join(outDir,'pairings.jsonl'),   toLines(pairings),   'utf8');
  await fs.writeFile(path.join(outDir,'edges.jsonl'),      toLines(edges),      'utf8');
  const combined = toLines([...ingredients, ...pairings, ...edges]);
  await fs.writeFile(path.join(outDir,'graph.jsonl'), combined, 'utf8');

  console.log('Wrote data/jsonl/{ingredients.jsonl,pairings.jsonl,edges.jsonl,graph.jsonl}');
}
main().catch(e=>{ console.error(e); process.exit(1); });
