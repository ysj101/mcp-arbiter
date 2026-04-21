import type { Policy } from '@arbiter/shared-types';
import { NextResponse } from 'next/server';
import { getStorage } from '@/lib/storage';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ policyId: string }>;
}

export async function GET(_req: Request, ctx: Params) {
  const { policyId } = await ctx.params;
  const storage = await getStorage();
  const policy = await storage.getPolicy(policyId);
  if (!policy) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  return NextResponse.json({ policy });
}

export async function PUT(req: Request, ctx: Params) {
  const { policyId } = await ctx.params;
  const body = (await req.json()) as Partial<Policy>;
  const storage = await getStorage();
  const existing = await storage.getPolicy(policyId);
  if (!existing) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  const merged: Policy = {
    ...existing,
    ...body,
    policyId,
    updatedAt: new Date().toISOString(),
    version: existing.version + 1,
  };
  const saved = await storage.upsertPolicy(merged);
  return NextResponse.json({ policy: saved });
}

export async function DELETE(_req: Request, ctx: Params) {
  const { policyId } = await ctx.params;
  const storage = await getStorage();
  await storage.deletePolicy(policyId);
  return NextResponse.json({ ok: true });
}
