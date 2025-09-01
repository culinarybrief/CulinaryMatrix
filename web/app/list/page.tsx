"use client";
import { useEffect, useMemo, useState } from "react";

type Item = { name: string; notes?: string; qty?: number; unit?: string };
type PlanSummary = { id: string; title: string; createdAt: string };

export default function ListPage() {
  const [titles, setTitles] = useState("Southwest Burrito Bowl|Chicken & Vegetable Soup");
  const [planTitle, setPlanTitle] = useState("My Plan");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string|null>(null);
  const [raw, setRaw]         = useState<any>(null);
  const [showAmounts, setShowAmounts] = useState(false);
  const [editing, setEditing] = useState<Item[]|null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [recents, setRecents] = useState<PlanSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  // fetch recents on load and after saves
  async function refreshRecents() {
    try {
      const r = await fetch("/api/plans");
      const j = await r.json();
      if (Array.isArray(j)) setRecents(j);
    } catch {}
  }
  useEffect(()=>{ refreshRecents(); }, []);

  async function makeList() {
    setLoading(true); setError(null); setRaw(null); setSavedId(null);
    try {
      const res = await fetch("/api/shop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ titles })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Request failed");
      setRaw(json);
      const items: Item[] = Array.isArray(json?.items)
        ? json.items.map((it:any) => {
            if (typeof it === "string") return { name: it };
            return {
              name: it.name ?? it.ingredient ?? it.title ?? JSON.stringify(it),
              qty: (it.display_qty ?? it.qty ?? null) ?? undefined,
              unit: (it.display_unit ?? it.unit ?? null) ?? undefined,
              notes: it.notes ?? undefined
            };
          })
        : [];
      setEditing(items);
      localStorage.setItem("cb:lastList", JSON.stringify({ titles, items }));
    } catch (e:any) {
      setError(e.message);
    } finally { setLoading(false); }
  }

  function updateItem(i:number, patch:Partial<Item>) {
    if (!editing) return;
    const next = editing.slice(); next[i] = { ...next[i], ...patch }; setEditing(next);
    localStorage.setItem("cb:lastList", JSON.stringify({ titles, items: next }));
  }

  const displayItems = useMemo(() => editing ?? [], [editing]);

  async function savePlan() {
    if (!displayItems.length) return;
    const res = await fetch("/api/plans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: planTitle || "My Plan", titles, items: displayItems })
    });
    const json = await res.json();
    if (res.ok) {
      setSavedId(json.id);
      await refreshRecents();
    } else {
      alert(json.error || "Save failed");
    }
  }

  async function loadSelected() {
    if (!selectedId) return;
    const r = await fetch(`/api/plans/${selectedId}`);
    const j = await r.json();
    if (!r.ok) return alert(j?.error || "Load failed");
    setPlanTitle(j.title);
    setTitles(j.titlesStr);
    try { setEditing(JSON.parse(j.itemsJson)); } catch { setEditing([]); }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Shopping List (MVP)</h1>

      <div className="grid gap-2">
        <label className="text-sm">Plan title</label>
        <input value={planTitle} onChange={e=>setPlanTitle(e.target.value)} className="border rounded-xl p-3 w-full" />
      </div>

      <div className="grid gap-2">
        <label className="text-sm">Recipe titles (use | between titles)</label>
        <input
          value={titles}
          onChange={e=>setTitles(e.target.value)}
          className="border rounded-xl p-3 w-full"
          placeholder="Title A|Title B|Title C"
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={makeList} disabled={loading} className="rounded-2xl px-4 py-2 border shadow disabled:opacity-50">
          {loading ? "Building…" : "Get List"}
        </button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showAmounts} onChange={e=>setShowAmounts(e.target.checked)} />
          Show amounts
        </label>
        <button onClick={savePlan} disabled={!displayItems.length} className="rounded-2xl px-4 py-2 border shadow disabled:opacity-50">
          Save
        </button>
        {savedId && <a className="underline text-sm" href={`/api/plans/${savedId}`} target="_blank" rel="noreferrer">View saved JSON</a>}
      </div>

      <div className="flex items-end gap-2 flex-wrap">
        <div className="grid">
          <label className="text-sm">Load a recent plan</label>
          <select
            value={selectedId}
            onChange={e=>setSelectedId(e.target.value)}
            className="border rounded-xl p-2 min-w-[240px]"
          >
            <option value="">— choose —</option>
            {recents.map(p=>(
              <option key={p.id} value={p.id}>
                {new Date(p.createdAt).toLocaleString()} — {p.title}
              </option>
            ))}
          </select>
        </div>
        <button onClick={loadSelected} disabled={!selectedId} className="rounded-2xl px-3 py-2 border shadow disabled:opacity-50">
          Load
        </button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {displayItems.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium">Review & Edit</h2>
          <ul className="space-y-2">
            {displayItems.map((it, i) => (
              <li key={i} className="flex gap-2 items-center">
                <input
                  className="border rounded p-2 flex-1"
                  value={it.name}
                  onChange={e=>updateItem(i,{name:e.target.value})}
                />
                {showAmounts && (
                  <>
                    <input
                      className="border rounded p-2 w-20"
                      placeholder="qty"
                      value={it.qty ?? ""}
                      onChange={e=>updateItem(i,{qty:e.target.value ? Number(e.target.value) : undefined})}
                    />
                    <input
                      className="border rounded p-2 w-24"
                      placeholder="unit"
                      value={it.unit ?? ""}
                      onChange={e=>updateItem(i,{unit:e.target.value || undefined})}
                    />
                  </>
                )}
                <input
                  className="border rounded p-2 w-40"
                  placeholder="notes/brand"
                  value={it.notes ?? ""}
                  onChange={e=>updateItem(i,{notes:e.target.value || undefined})}
                />
                <button className="border rounded px-2 py-1" onClick={()=>{
                  const next = displayItems.filter((_,idx)=>idx!==i); setEditing(next);
                  localStorage.setItem("cb:lastList", JSON.stringify({ titles, items: next }));
                }}>Remove</button>
                <button className="border rounded px-2 py-1" onClick={()=>{
                  const next = displayItems.slice(); next.splice(i+1,0,{...it}); setEditing(next);
                  localStorage.setItem("cb:lastList", JSON.stringify({ titles, items: next }));
                }}>+More</button>
              </li>
            ))}
          </ul>

          <div className="flex gap-2">
            <a
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(displayItems.map(it=>{
                const qty = showAmounts && it.qty ? ` x${it.qty}${it.unit?` ${it.unit}`:""}` : "";
                return `• ${it.name}${qty}${it.notes?` — ${it.notes}`:""}`;
              }).join("\n"))}`}
              download="shopping-list.txt"
              className="border rounded px-3 py-2 inline-block"
            >Download Text</a>

            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(
                ["name,qty,unit,notes", ...displayItems.map(it =>
                  [it.name, it.qty ?? "", it.unit ?? "", (it.notes ?? "").replace(/"/g,'""')].map(v=>`"${v}"`).join(",")
                )].join("\n")
              )}`}
              download="shopping-list.csv"
              className="border rounded px-3 py-2 inline-block"
            >Download CSV</a>
          </div>
        </div>
      )}

      {raw && (
        <details className="mt-6">
          <summary className="cursor-pointer">Raw JSON (debug)</summary>
          <pre className="bg-gray-100 p-4 rounded-xl overflow-auto text-sm">{JSON.stringify(raw,null,2)}</pre>
        </details>
      )}
    </div>
  );
}
