export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const exec = promisify(execFile);
const ROOT = path.resolve(process.cwd(), ".."); // repo root

export async function POST(req: NextRequest) {
  try {
    const { ingredients = [], cuisine = "", top = 10 } = await req.json();
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json({ error: "ingredients[] required" }, { status: 400 });
    }
    const args = ["run", "-s", "suggest", "--", ...ingredients];
    if (cuisine) args.push(`--cuisine=${cuisine}`);
    args.push(`--top=${top}`);

    const { stdout } = await exec("pnpm", args, { cwd: ROOT });
    let data: any;
    try { data = JSON.parse(stdout); } catch { data = { raw: stdout }; }
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }
}
