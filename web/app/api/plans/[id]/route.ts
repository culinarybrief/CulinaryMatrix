export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_: NextRequest, { params }: { params: { id: string }}) {
  const plan = await prisma.plan.findUnique({ where: { id: params.id }});
  if (!plan) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json(plan);
}
