import type { Verdict } from '@arbiter/shared-types';
import { AppShell } from '@/components/AppShell';
import { getStorage } from '@/lib/storage';
import { PrecedentsClient } from './PrecedentsClient';

export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{
    decision?: string;
    q?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function PrecedentsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const storage = await getStorage();
  const list: Verdict[] = await storage.listVerdicts({
    ...(sp.decision === 'allow' || sp.decision === 'deny' ? { decision: sp.decision } : {}),
    ...(sp.from ? { fromDate: sp.from } : {}),
    ...(sp.to ? { toDate: sp.to } : {}),
    limit: 200,
  });
  const q = sp.q?.toLowerCase();
  const filtered = q
    ? list.filter(
        (v) =>
          v.judgment.toLowerCase().includes(q) ||
          (v.charge ?? '').toLowerCase().includes(q) ||
          v.agentId.toLowerCase().includes(q),
      )
    : list;

  return (
    <AppShell>
      <section className="court-card p-8">
        <h1 className="font-court-serif text-3xl text-court-gold">判例集</h1>
        <p className="mt-2 text-sm text-court-ivory/70">
          これまでに本法廷が下した判決の集合です。罪状 / 判決文 / エージェント ID で検索できます。
        </p>
        <PrecedentsClient
          initial={filtered}
          initialFilter={{
            ...(sp.decision ? { decision: sp.decision } : {}),
            ...(sp.q ? { q: sp.q } : {}),
            ...(sp.from ? { from: sp.from } : {}),
            ...(sp.to ? { to: sp.to } : {}),
          }}
        />
      </section>
    </AppShell>
  );
}
