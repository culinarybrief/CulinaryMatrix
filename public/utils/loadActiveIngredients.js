export async function loadActiveIngredients(url='/data/jsonl/ingredients.dropdown.jsonl') {
  const res = await fetch(url);
  const text = await res.text();
  return text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line).Ingredient);
}
