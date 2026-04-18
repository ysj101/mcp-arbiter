import { AppShell } from '@/components/AppShell';
import { getStorage } from '@/lib/storage';
import type { Policy } from '@arbiter/shared-types';
import { PolicyEditorClient } from './PolicyEditorClient';

export const dynamic = 'force-dynamic';

export default async function PoliciesPage() {
  const storage = await getStorage();
  const policies: Policy[] = await storage.listPolicies();
  return (
    <AppShell>
      <section className="court-card p-8">
        <h1 className="font-court-serif text-3xl text-court-gold">憲法編集</h1>
        <p className="mt-2 text-sm text-court-ivory/70">
          法廷が用いる条文 (policy) を閲覧・編集します。保存後は Arbiter
          の次回判定から反映されます。
        </p>
        <div className="mt-6">
          <PolicyEditorClient initialPolicies={policies} />
        </div>
      </section>
    </AppShell>
  );
}
