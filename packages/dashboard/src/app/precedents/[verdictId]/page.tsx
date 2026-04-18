import { AppShell } from '@/components/AppShell';
import { getStorage } from '@/lib/storage';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ verdictId: string }>;
}

export default async function VerdictDetailPage({ params }: Props) {
  const { verdictId } = await params;
  const storage = await getStorage();
  const v = await storage.getVerdict(verdictId);
  if (!v) notFound();

  return (
    <AppShell>
      <div className="mb-4 text-sm">
        <Link href="/precedents" className="text-court-gold hover:underline">
          ← 判例集へ戻る
        </Link>
      </div>
      <section className="court-card p-8">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`rounded-sm px-3 py-0.5 text-xs uppercase tracking-wider ${
                v.decision === 'deny'
                  ? 'bg-red-500/20 text-red-200'
                  : 'bg-emerald-500/20 text-emerald-200'
              }`}
            >
              {v.decision === 'deny' ? '棄却' : '許可'}
            </span>
            <h1 className="font-court-serif text-2xl text-court-gold">{v.charge ?? '罪状なし'}</h1>
          </div>
          <div className="text-xs text-court-ivory/60">
            {new Date(v.createdAt).toLocaleString('ja-JP')}
          </div>
        </header>
        <dl className="mt-6 grid grid-cols-2 gap-4 text-xs text-court-ivory/70 md:grid-cols-4">
          <div>
            <dt className="text-court-gold-soft">agent</dt>
            <dd>{v.agentId}</dd>
          </div>
          <div>
            <dt className="text-court-gold-soft">intent</dt>
            <dd>{v.intentId}</dd>
          </div>
          {v.policyRef && (
            <div>
              <dt className="text-court-gold-soft">policy</dt>
              <dd>{v.policyRef}</dd>
            </div>
          )}
          <div>
            <dt className="text-court-gold-soft">confidence</dt>
            <dd>{Math.round(v.confidence * 100)}%</dd>
          </div>
        </dl>
        <section className="mt-8">
          <h2 className="text-court-gold-soft text-sm uppercase tracking-widest">判決文</h2>
          <pre className="mt-2 whitespace-pre-wrap rounded border border-court-gold/20 bg-court-navy/70 p-4 text-sm text-court-ivory">
            {v.judgment}
          </pre>
        </section>
        {v.evidence.length > 0 && (
          <section className="mt-8">
            <h2 className="text-court-gold-soft text-sm uppercase tracking-widest">証拠</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {v.evidence.map((e) => (
                <li
                  key={`${e.location}-${e.excerpt}`}
                  className="rounded border border-court-gold/20 bg-court-navy/50 p-3"
                >
                  <div className="text-xs text-court-ivory/60">{e.location}</div>
                  <div className="mt-1">{e.excerpt}</div>
                  {e.detectedCategory && (
                    <div className="mt-1 text-xs text-court-gold-soft">
                      category: {e.detectedCategory}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        {v.subAgentOpinions.length > 0 && (
          <section className="mt-8">
            <h2 className="text-court-gold-soft text-sm uppercase tracking-widest">審理官意見</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {v.subAgentOpinions.map((o) => (
                <li
                  key={o.subAgentId}
                  className="rounded border border-court-gold/20 bg-court-navy/50 p-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-court-gold-soft">
                      {o.role} · {o.subAgentId}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] ${
                        o.verdict === 'deny'
                          ? 'bg-red-500/20 text-red-200'
                          : o.verdict === 'allow'
                            ? 'bg-emerald-500/20 text-emerald-200'
                            : 'bg-slate-500/20 text-slate-200'
                      }`}
                    >
                      {o.verdict} ({Math.round(o.confidence * 100)}%)
                    </span>
                  </div>
                  <p className="mt-1 text-court-ivory/80">{o.rationale}</p>
                </li>
              ))}
            </ul>
          </section>
        )}
        {v.traceId && (
          <section className="mt-8 text-xs text-court-ivory/50">trace: {v.traceId}</section>
        )}
      </section>
    </AppShell>
  );
}
