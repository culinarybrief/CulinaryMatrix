"use client";
import { useState } from "react";

export default function PlannerPage() {
  const [ingredients, setIngredients] = useState("chicken, lime, cilantro");
  const [cuisine, setCuisine] = useState("mexican");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const onSuggest = async () => {
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ingredients: ingredients.split(",").map(s => s.trim()).filter(Boolean),
          cuisine, top: 12
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Request failed");
      setResult(data);
    } catch (e:any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">CulinaryBrief – Planner (MVP)</h1>
      <div className="grid gap-3">
        <label className="text-sm">Ingredients (comma-separated)</label>
        <input
          value={ingredients}
          onChange={e=>setIngredients(e.target.value)}
          className="border rounded-xl p-3"
          placeholder="basil, tomato, garlic"
        />
        <label className="text-sm">Cuisine (optional)</label>
        <input
          value={cuisine}
          onChange={e=>setCuisine(e.target.value)}
          className="border rounded-xl p-3"
          placeholder="italian"
        />
        <button
          onClick={onSuggest}
          disabled={loading}
          className="rounded-2xl px-4 py-2 border shadow disabled:opacity-50 w-fit"
        >
          {loading ? "Thinking…" : "Get Suggestions"}
        </button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {result && (
        <div className="space-y-4">
          <h2 className="text-xl font-medium">Top Suggestions</h2>
          <pre className="bg-gray-100 p-4 rounded-xl overflow-auto text-sm">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
