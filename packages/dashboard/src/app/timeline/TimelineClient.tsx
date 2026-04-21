'use client';

import type { Verdict } from '@arbiter/shared-types';
import { useEffect, useState } from 'react';

type Stage = 'intent.received' | 'policy.evaluating' | 'verdict.decided';

interface Props {
  initial: Verdict[];
}

const stageLabel: Record<Stage, string> = {
  'intent.received': '① 申立受付',
  'policy.evaluating': '② 憲法審査',
  'verdict.decided': '③ 判決宣告',
};

export const TimelineClient = ({ initial }: Props) => {
  const [verdicts, setVerdicts] = useState<Verdict[]>(initial);
  const [stage, setStage] = useState<Stage | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource('/api/events');
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.addEventListener('intent.received', () => setStage('intent.received'));
    es.addEventListener('policy.evaluating', () => setStage('policy.evaluating'));
    es.addEventListener('verdict.decided', (e) => {
      const payload = JSON.parse((e as MessageEvent).data) as { verdict: Verdict };
      setVerdicts((prev) => [payload.verdict, ...prev].slice(0, 50));
      setStage('verdict.decided');
      setTimeout(() => setStage(null), 2000);
    });
    return () => es.close();
  }, []);

  return (
    <div>
      <div className="flex items-center gap-3 text-xs">
        <span
          className={`inline-block h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-gray-500'}`}
        />
        <span className="text-court-ivory/70">{connected ? 'SSE 接続中' : 'SSE 未接続'}</span>
        {stage && (
          <span className="ml-3 rounded-full border border-court-gold/40 px-3 py-0.5 text-court-gold">
            {stageLabel[stage]}
          </span>
        )}
      </div>
      <ul className="mt-6 space-y-4">
        {verdicts.length === 0 && (
          <li className="rounded border border-court-gold/20 p-4 text-xs text-court-ivory/60">
            まだ判決はありません。エージェントからの申立を待機しています。
          </li>
        )}
        {verdicts.map((v) => (
          <li
            key={v.verdictId}
            className={`court-card p-5 ${
              v.decision === 'deny' ? 'ring-1 ring-red-500/40' : 'ring-1 ring-emerald-500/30'
            }`}
          >
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span
                  className={`rounded-sm px-2 py-0.5 text-xs uppercase tracking-wider ${
                    v.decision === 'deny'
                      ? 'bg-red-500/20 text-red-200'
                      : 'bg-emerald-500/20 text-emerald-200'
                  }`}
                >
                  {v.decision === 'deny' ? '棄却' : '許可'}
                </span>
                {v.charge && (
                  <span className="ml-3 text-sm text-court-ivory/80">罪状: {v.charge}</span>
                )}
              </div>
              <div className="text-xs text-court-ivory/50">
                {new Date(v.createdAt).toLocaleString('ja-JP')}
              </div>
            </header>
            <div className="mt-3 text-xs text-court-ivory/60">
              agent: {v.agentId} · intent: {v.intentId}{' '}
              {v.policyRef && (
                <span className="ml-2 text-court-gold-soft">policy: {v.policyRef}</span>
              )}
            </div>
            <pre className="mt-3 whitespace-pre-wrap text-sm text-court-ivory">{v.judgment}</pre>
            {v.subAgentOpinions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {v.subAgentOpinions.map((o) => (
                  <span
                    key={o.subAgentId}
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${
                      o.verdict === 'deny'
                        ? 'border-red-400/40 text-red-200'
                        : 'border-emerald-400/40 text-emerald-200'
                    }`}
                  >
                    {o.role}: {o.verdict}
                  </span>
                ))}
              </div>
            )}
            {v.evidence.length > 0 && (
              <div className="mt-3 rounded border border-court-gold/20 bg-court-navy/50 p-3 text-xs text-court-ivory/80">
                <div className="mb-1 font-medium text-court-gold-soft">証拠</div>
                {v.evidence.map((e, idx) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: evidence entries have no stable id from backend
                  <div key={`${v.verdictId}-ev-${idx}`}>
                    <span className="text-court-ivory/60">{e.location}:</span>{' '}
                    <span>{e.excerpt}</span>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
