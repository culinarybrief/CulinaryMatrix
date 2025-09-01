export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// List recent plans
export async function GET() {
  const plans = await prisma.plan.findMany({
    select: { id: true, title: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });
  return NextResponse.json(plans);
}

// Create a new plan
export async function POST(req: NextRequest) {
  const { title = 'My Plan', titles = '', items = [] } = await req.json();
  const titlesStr = Array.isArray(titles) ? titles.join('|') : String(titles);
  const itemsJson = JSON.stringify(items);
  const plan = await prisma.plan.create({ data: { title, titlesStr, itemsJson } });
  return NextResponse.json(plan, { status: 201 });
}
