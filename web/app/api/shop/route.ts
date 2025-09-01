export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const exec = promisify(execFile);
const ROOT = path.resolve(process.cwd(), ".."); // repo root

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const titlesIn = Array.isArray(body.titles)
      ? body.titles
      : String(body.titles ?? "").split("|");
    const titles = titlesIn.map(s => String(s).trim()).filter(Boolean);
    if (titles.length === 0) {
      return NextResponse.json({ error: "titles required (array or 'A|B|C')" }, { status: 400 });
    }
    const { stdout } = await exec("pnpm", ["run","-s","shop","--", `--titles=${titles.join("|")}`], { cwd: ROOT });
    let data:any;
    try { data = JSON.parse(stdout); } catch { data = { raw: stdout }; }
    return NextResponse.json(data);
  } catch (e:any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
