import { getStorage } from '@/lib/storage';
import type { Policy } from '@arbiter/shared-types';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const storage = await getStorage();
  const policies = await storage.listPolicies();
  return NextResponse.json({ policies });
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<Policy>;
  if (!body.name || !body.action) {
    return NextResponse.json({ error: 'name and action are required' }, { status: 400 });
  }
  const now = new Date().toISOString();
  const policy: Policy = {
    policyId: body.policyId ?? `policy-${Date.now()}`,
    name: body.name,
    description: body.description ?? '',
    sensitiveCategories: body.sensitiveCategories ?? [],
    rules: body.rules ?? [],
    ...(body.llmJudgePrompt ? { llmJudgePrompt: body.llmJudgePrompt } : {}),
    action: body.action,
    enabled: body.enabled ?? true,
    createdAt: body.createdAt ?? now,
    updatedAt: now,
    version: (body.version ?? 0) + 1,
  };
  const storage = await getStorage();
  const saved = await storage.upsertPolicy(policy);
  return NextResponse.json({ policy: saved }, { status: 201 });
}
