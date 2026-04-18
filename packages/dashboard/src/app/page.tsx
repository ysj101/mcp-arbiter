import { AppShell } from '@/components/AppShell';
import { courtTerminology } from '@/lib/terminology';

export default function HomePage() {
  return (
    <AppShell>
      <section className="court-card p-10">
        <h1 className="font-court-serif text-4xl text-court-gold">MCP Arbiter 法廷</h1>
        <p className="mt-4 text-court-ivory/80">
          エージェントの {courtTerminology.intent} に対し、この法廷は冷静かつ厳正に審理を行い、
          {courtTerminology.verdict} を下します。
        </p>
        <dl className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-4">
          <div>
            <dt className="text-xs uppercase tracking-widest text-court-gold-soft">
              {courtTerminology.intent}
            </dt>
            <dd className="mt-1 text-sm text-court-ivory/70">意図の構造化</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-court-gold-soft">
              {courtTerminology.policy}
            </dt>
            <dd className="mt-1 text-sm text-court-ivory/70">ルール + LLM 合議</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-court-gold-soft">
              {courtTerminology.verdict}
            </dt>
            <dd className="mt-1 text-sm text-court-ivory/70">ALLOW / DENY 判定</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-widest text-court-gold-soft">
              {courtTerminology.precedents}
            </dt>
            <dd className="mt-1 text-sm text-court-ivory/70">過去判決の検索</dd>
          </div>
        </dl>
      </section>
    </AppShell>
  );
}
