"use client";
import { useState } from "react";

export default function ListPage() {
  const [titles, setTitles] = useState("Southwest Burrito Bowl|Chicken & Vegetable Soup");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string|null>(null);
  const [data, setData]       = useState<any>(null);

  async function makeList() {
    setLoading(true); setError(null); setData(null);
    try {
      const res = await fetch("/api/shop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ titles })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Request failed");
      setData(json);
    } catch (e:any) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  // Try to derive a simple checklist if shape is friendly; otherwise show raw JSON.
  const checklist: string[] | null = Array.isArray(data?.items)
    ? data.items.map((it:any) => typeof it === "string" ? it : (it.name ?? it.ingredient ?? JSON.stringify(it)))
    : null;

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Shopping List (MVP)</h1>
      <label className="text-sm">Recipe titles (use | between titles)</label>
      <input
        value={titles}
        onChange={e=>setTitles(e.target.value)}
        className="border rounded-xl p-3 w-full"
        placeholder="Title A|Title B|Title C"
      />
      <button onClick={makeList} disabled={loading} className="rounded-2xl px-4 py-2 border shadow disabled:opacity-50 w-fit">
        {loading ? "Building…" : "Get List"}
      </button>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {checklist && (
        <div className="space-y-2">
          <h2 className="text-lg font-medium">Checklist</h2>
          <ul className="list-disc ml-5">
            {checklist.map((x, i) => <li key={i}>{x}</li>)}
          </ul>
        </div>
      )}

      {data && (
        <div className="space-y-2">
          <h2 className="text-lg font-medium">Raw JSON</h2>
          <pre className="bg-gray-100 p-4 rounded-xl overflow-auto text-sm">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
