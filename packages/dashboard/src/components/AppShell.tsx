import Link from 'next/link';
import type { ReactNode } from 'react';
import { resolveAuthAdapter } from '@/lib/auth';
import { courtTerminology } from '@/lib/terminology';

interface NavItem {
  label: string;
  href: string;
}

const NAV: NavItem[] = [
  { label: `${courtTerminology.verdict}タイムライン`, href: '/timeline' },
  { label: courtTerminology.precedents, href: '/precedents' },
  { label: `${courtTerminology.policy}編集`, href: '/policies' },
];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const user = resolveAuthAdapter().getCurrentUser();
  return (
    <div className="min-h-screen bg-court-navy-dark text-court-ivory">
      <header className="border-b border-court-gold/30 bg-court-navy">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-2xl text-court-gold">⚖</span>
            <span className="font-court-serif text-2xl tracking-wide">MCP Arbiter 法廷</span>
          </Link>
          <nav className="flex flex-1 gap-6 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-court-ivory/80 transition hover:text-court-gold"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="text-right text-xs text-court-ivory/70">
            <div className="text-court-gold">{user?.displayName ?? '未認証'}</div>
            <div>{user?.role ?? '-'}</div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      <footer className="mx-auto max-w-6xl px-6 pb-10 text-xs text-court-ivory/50">
        Constitution Layer for Agentic Systems · MCP Arbiter
      </footer>
    </div>
  );
};
