'use client';

import type { Policy } from '@arbiter/shared-types';
import { useState } from 'react';

interface Props {
  initialPolicies: Policy[];
}

const emptyPolicy = (): Partial<Policy> => ({
  policyId: `policy-${Date.now()}`,
  name: '',
  description: '',
  sensitiveCategories: [],
  rules: [],
  action: 'deny',
  enabled: true,
});

export const PolicyEditorClient = ({ initialPolicies }: Props) => {
  const [policies, setPolicies] = useState<Policy[]>(initialPolicies);
  const [form, setForm] = useState<Partial<Policy>>(emptyPolicy);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await fetch('/api/policies', { cache: 'no-store' });
    const data = (await res.json()) as { policies: Policy[] };
    setPolicies(data.policies);
  };

  const handleSelect = (policy: Policy) => {
    setEditing(policy.policyId);
    setForm({ ...policy });
  };

  const handleNew = () => {
    setEditing(null);
    setForm(emptyPolicy());
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await fetch(`/api/policies/${editing}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(form),
        });
      } else {
        await fetch('/api/policies', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(form),
        });
      }
      await load();
      handleNew();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (policyId: string) => {
    if (!confirm(`${policyId} を削除しますか？`)) return;
    await fetch(`/api/policies/${policyId}`, { method: 'DELETE' });
    await load();
    if (editing === policyId) handleNew();
  };

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-5">
      <aside className="md:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="text-court-gold-soft text-sm uppercase tracking-widest">条文一覧</h2>
          <button
            type="button"
            onClick={handleNew}
            className="rounded border border-court-gold/60 px-3 py-1 text-xs text-court-gold transition hover:bg-court-gold/10"
          >
            + 新規
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {policies.length === 0 && (
            <li className="rounded border border-court-gold/20 p-3 text-xs text-court-ivory/60">
              まだ条文がありません。新規作成してください。
            </li>
          )}
          {policies.map((p) => (
            <li
              key={p.policyId}
              className={`cursor-pointer rounded border p-3 text-sm transition ${
                editing === p.policyId
                  ? 'border-court-gold bg-court-gold/10'
                  : 'border-court-gold/20 hover:border-court-gold/60'
              }`}
            >
              <button
                type="button"
                onClick={() => handleSelect(p)}
                className="block w-full text-left"
              >
                <div className="font-medium text-court-ivory">{p.name}</div>
                <div className="mt-1 text-xs text-court-ivory/60">
                  {p.action.toUpperCase()} · v{p.version} · {p.enabled ? '有効' : '無効'}
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleDelete(p.policyId)}
                className="mt-2 text-[11px] text-red-300/80 hover:text-red-300"
              >
                削除
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="md:col-span-3">
        <h2 className="text-court-gold-soft text-sm uppercase tracking-widest">
          {editing ? `編集: ${editing}` : '新規作成'}
        </h2>
        <div className="mt-4 space-y-4 text-sm">
          <label className="block">
            <span className="text-court-ivory/70">名称</span>
            <input
              className="mt-1 w-full rounded border border-court-gold/30 bg-court-navy px-3 py-2 text-court-ivory"
              value={form.name ?? ''}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-court-ivory/70">説明</span>
            <textarea
              className="mt-1 w-full rounded border border-court-gold/30 bg-court-navy px-3 py-2 text-court-ivory"
              rows={2}
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="text-court-ivory/70">機密カテゴリ (カンマ区切り)</span>
            <input
              className="mt-1 w-full rounded border border-court-gold/30 bg-court-navy px-3 py-2 text-court-ivory"
              value={(form.sensitiveCategories ?? []).join(', ')}
              onChange={(e) =>
                setForm({
                  ...form,
                  sensitiveCategories: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <label className="block">
            <span className="text-court-ivory/70">LLM 審理プロンプト (任意)</span>
            <textarea
              className="mt-1 w-full rounded border border-court-gold/30 bg-court-navy px-3 py-2 text-court-ivory"
              rows={3}
              value={form.llmJudgePrompt ?? ''}
              onChange={(e) => setForm({ ...form, llmJudgePrompt: e.target.value })}
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-court-ivory/70">action</span>
              <select
                className="mt-1 w-full rounded border border-court-gold/30 bg-court-navy px-3 py-2 text-court-ivory"
                value={form.action ?? 'deny'}
                onChange={(e) => setForm({ ...form, action: e.target.value as Policy['action'] })}
              >
                <option value="deny">deny</option>
                <option value="allow">allow</option>
                <option value="review">review</option>
              </select>
            </label>
            <label className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                checked={form.enabled ?? true}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
              />
              <span className="text-court-ivory/70">enabled</span>
            </label>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !form.name}
            className="rounded bg-court-gold px-4 py-2 text-sm font-medium text-court-navy-dark transition hover:bg-court-gold-soft disabled:opacity-50"
          >
            {saving ? '保存中…' : editing ? '更新' : '作成'}
          </button>
        </div>
      </div>
    </div>
  );
};
