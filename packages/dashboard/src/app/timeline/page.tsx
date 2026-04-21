import type { Verdict } from '@arbiter/shared-types';
import { AppShell } from '@/components/AppShell';
import { getStorage } from '@/lib/storage';
import { TimelineClient } from './TimelineClient';

export const dynamic = 'force-dynamic';

export default async function TimelinePage() {
  const storage = await getStorage();
  const initial: Verdict[] = await storage.listVerdicts({ limit: 30 });
  return (
    <AppShell>
      <section className="court-card p-8">
        <h1 className="font-court-serif text-3xl text-court-gold">判決タイムライン</h1>
        <p className="mt-2 text-sm text-court-ivory/70">
          申立 → 憲法審査 → 判決 の三段階がリアルタイムに更新されます。新規判決は SSE (ローカル) /
          Azure Web PubSub (クラウド) から届きます。
        </p>
        <div className="mt-6">
          <TimelineClient initial={initial} />
        </div>
      </section>
    </AppShell>
  );
}
