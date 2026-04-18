'use client';

import type { Verdict } from '@arbiter/shared-types';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

interface Filter {
  decision?: string;
  q?: string;
  from?: string;
  to?: string;
}

interface Props {
  initial: Verdict[];
  initialFilter: Filter;
}

export const PrecedentsClient = ({ initial, initialFilter }: Props) => {
  const router = useRouter();
  const params = useSearchParams();
  const [filter, setFilter] = useState<Filter>(initialFilter);

  const applyFilter = () => {
    const next = new URLSearchParams(params.toString());
    for (const key of ['decision', 'q', 'from', 'to'] as const) {
      const value = filter[key];
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push(`/precedents?${next.toString()}`);
  };

  return (
    <>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <select
          className="rounded border border-court-gold/30 bg-court-navy px-3 py-2 text-sm text-court-ivory"
          value={filter.decision ?? ''}
          onChange={(e) => setFilter({ ...filter, decision: e.target.value || undefined })}
        >
          <option value="">全判決</option>
          <option value="allow">許可のみ</option>
          <option value="deny">棄却のみ</option>
        </select>
        <input
          type="text"
          placeholder="罪状 / 判決文 / agent"
          className="rounded border border-court-gold/30 bg-court-navy px-3 py-2 text-sm text-court-ivory"
          value={filter.q ?? ''}
          onChange={(e) => setFilter({ ...filter, q: e.target.value || undefined })}
        />
        <input
          type="date"
          className="rounded border border-court-gold/30 bg-court-navy px-3 py-2 text-sm text-court-ivory"
          value={filter.from ?? ''}
          onChange={(e) => setFilter({ ...filter, from: e.target.value || undefined })}
        />
        <input
          type="date"
          className="rounded border border-court-gold/30 bg-court-navy px-3 py-2 text-sm text-court-ivory"
          value={filter.to ?? ''}
          onChange={(e) => setFilter({ ...filter, to: e.target.value || undefined })}
        />
      </div>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={applyFilter}
          className="rounded bg-court-gold px-4 py-2 text-sm font-medium text-court-navy-dark transition hover:bg-court-gold-soft"
        >
          検索
        </button>
      </div>
      <ul className="mt-6 divide-y divide-court-gold/10">
        {initial.length === 0 && (
          <li className="py-6 text-xs text-court-ivory/60">条件に合致する判決はありません。</li>
        )}
        {initial.map((v) => (
          <li key={v.verdictId} className="py-4">
            <Link
              href={`/precedents/${v.verdictId}`}
              className="block transition hover:bg-court-gold/5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-sm px-2 py-0.5 text-[11px] uppercase tracking-wider ${
                      v.decision === 'deny'
                        ? 'bg-red-500/20 text-red-200'
                        : 'bg-emerald-500/20 text-emerald-200'
                    }`}
                  >
                    {v.decision === 'deny' ? '棄却' : '許可'}
                  </span>
                  <span className="text-sm text-court-ivory/80">{v.charge ?? '罪状なし'}</span>
                </div>
                <span className="text-[11px] text-court-ivory/50">
                  {new Date(v.createdAt).toLocaleString('ja-JP')}
                </span>
              </div>
              <div className="mt-1 text-xs text-court-ivory/60">
                agent {v.agentId} · intent {v.intentId}
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-court-ivory/80">
                {v.judgment.split('\n')[0]}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
};
