#!/usr/bin/env tsx
/**
 * End-to-end smoke: boot proxy with downstream dummy email MCP spawned as a
 * child process, run 3 demo scenarios, assert DENY/ALLOW/DENY results.
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { DemoAgentClient } from '@arbiter/client';
import { DEMO_SCENARIOS } from '@arbiter/client';

const PORT = Number(process.env.ARBITER_E2E_PORT ?? 17300);
const SECRET = 'e2e-secret';

const main = async (): Promise<void> => {
  const proxy = spawn('node', ['packages/proxy/dist/server.js'], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: {
      ...process.env,
      PORT: String(PORT),
      ARBITER_SHARED_SECRET: SECRET,
      ARBITER_DOWNSTREAM_COMMAND: 'node',
      ARBITER_DOWNSTREAM_ARGS: 'packages/mcp-tool/dist/server.js',
    },
  });

  const proxyExit = once(proxy, 'exit');
  void proxyExit;

  const waitForReady = async (): Promise<void> => {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://localhost:${PORT}/healthz`);
        if (res.ok) {
          const body = (await res.json()) as { downstream?: boolean };
          if (body.downstream) return;
        }
      } catch {
        /* keep polling */
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error('proxy did not become ready in time');
  };

  try {
    await waitForReady();

    const client = new DemoAgentClient({
      proxyUrl: `http://localhost:${PORT}`,
      bearerToken: SECRET,
    });

    const expectations: Record<string, 'allow' | 'deny'> = {
      'hr-eval-misdirect': 'deny',
      'daily-standup': 'allow',
      'credentials-leak': 'deny',
    };

    let failures = 0;
    for (const scenario of DEMO_SCENARIOS) {
      const result = await client.invoke(scenario.input);
      const expected = expectations[scenario.id];
      const actual = result.verdict?.decision ?? 'unknown';
      const ok = expected === actual;
      process.stdout.write(
        `[${scenario.id}] expected=${expected} actual=${actual} ${ok ? 'OK' : 'FAIL'}\n`,
      );
      if (!ok) failures += 1;
    }

    if (failures > 0) {
      throw new Error(`${failures} scenarios mismatched expectations`);
    }

    // Unauthorized request must be rejected.
    const unauth = await fetch(`http://localhost:${PORT}/invoke`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tool: 'send_email',
        parameters: { to: 'x@example.com', subject: '', body: '' },
      }),
    });
    if (unauth.status !== 401) {
      throw new Error(`unauthorized invoke returned ${unauth.status}, expected 401`);
    }
    process.stdout.write('[auth] unauthorized -> 401 OK\n');
    process.stdout.write('\nE2E OK.\n');
  } finally {
    proxy.kill('SIGTERM');
    await Promise.race([once(proxy, 'exit'), new Promise((r) => setTimeout(r, 1500))]);
  }
};

main().catch((err: unknown) => {
  process.stderr.write(`E2E failed: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
