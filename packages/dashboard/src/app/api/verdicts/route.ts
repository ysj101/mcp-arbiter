import { getPubSub } from '@/lib/pubsub';
import { getStorage } from '@/lib/storage';
import type { Verdict } from '@arbiter/shared-types';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const decision = url.searchParams.get('decision');
  const agentId = url.searchParams.get('agentId');
  const limit = Number(url.searchParams.get('limit') ?? '50');
  const q = url.searchParams.get('q')?.toLowerCase();
  const storage = await getStorage();
  const verdicts = await storage.listVerdicts({
    ...(decision === 'allow' || decision === 'deny' ? { decision } : {}),
    ...(agentId ? { agentId } : {}),
    limit,
  });
  const filtered = q
    ? verdicts.filter(
        (v) =>
          v.judgment.toLowerCase().includes(q) ||
          (v.charge ?? '').toLowerCase().includes(q) ||
          v.agentId.toLowerCase().includes(q),
      )
    : verdicts;
  return NextResponse.json({ verdicts: filtered });
}

export async function POST(req: Request) {
  const verdict = (await req.json()) as Verdict;
  const storage = await getStorage();
  const saved = await storage.saveVerdict(verdict);
  const pubsub = getPubSub();
  await pubsub.publish({
    type: 'verdict.decided',
    verdict: saved,
    occurredAt: new Date().toISOString(),
  });
  return NextResponse.json({ verdict: saved }, { status: 201 });
}
