#!/usr/bin/env node
import { DemoAgentClient } from './demo-agent.js';
import { DEMO_SCENARIOS, findScenario } from './scenarios.js';

const parseArgs = () => {
  const args = process.argv.slice(2);
  const opts: { proxyUrl: string; token?: string; scenario?: string; skipAuth: boolean } = {
    proxyUrl: process.env.ARBITER_PROXY_URL ?? 'http://localhost:7071',
    ...(process.env.ARBITER_AGENT_TOKEN ? { token: process.env.ARBITER_AGENT_TOKEN } : {}),
    skipAuth: false,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--proxy' && args[i + 1]) {
      const v = args[i + 1];
      if (v) opts.proxyUrl = v;
      i += 1;
    } else if (arg === '--token' && args[i + 1]) {
      const v = args[i + 1];
      if (v) opts.token = v;
      i += 1;
    } else if (arg === '--scenario' && args[i + 1]) {
      const v = args[i + 1];
      if (v) opts.scenario = v;
      i += 1;
    } else if (arg === '--skip-auth') {
      opts.skipAuth = true;
    }
  }
  return opts;
};

const formatResult = (sid: string, status: number, decision?: string, error?: string): string => {
  const badge = decision === 'deny' ? '⚠️ DENY' : decision === 'allow' ? '✅ ALLOW' : `${status}`;
  const suffix = error ? ` (${error})` : '';
  return `[${sid}] ${badge}${suffix}`;
};

const main = async (): Promise<void> => {
  const opts = parseArgs();
  const scenarios = opts.scenario ? [findScenario(opts.scenario)].filter(Boolean) : DEMO_SCENARIOS;
  if (scenarios.length === 0) {
    process.stderr.write(`scenario not found: ${opts.scenario}\n`);
    process.exit(2);
  }

  const client = new DemoAgentClient({
    proxyUrl: opts.proxyUrl,
    ...(opts.skipAuth ? {} : { bearerToken: opts.token ?? 'dev-shared-secret-change-me' }),
  });

  process.stdout.write(
    `proxy=${opts.proxyUrl} auth=${opts.skipAuth ? 'SKIPPED (for comparison)' : 'enabled'}\n\n`,
  );

  for (const scenario of scenarios) {
    if (!scenario) continue;
    process.stdout.write(`[${scenario.id}] ${scenario.description}\n`);
    const result = await client.invoke(scenario.input);
    process.stdout.write(
      `  ${formatResult(scenario.id, result.status, result.verdict?.decision, result.error)}\n`,
    );
    if (result.verdict) {
      const firstLine = result.verdict.judgment.split('\n')[0] ?? '';
      process.stdout.write(`  ${firstLine}\n`);
    }
    process.stdout.write('\n');
  }
};

main().catch((err: unknown) => {
  process.stderr.write(`demo-client failed: ${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
