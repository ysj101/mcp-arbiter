#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import {
  createAuthAdapter,
  createLLMAdapter,
  createStorageAdapter,
  InMemoryPubSubAdapter,
  loadConfig,
} from '@arbiter/core';
import type { Policy } from '@arbiter/shared-types';
import { buildPipeline } from './arbitrate.js';
import { DefaultDecisionEngine } from './decision-engine.js';
import { RuleBasedIntentAnalyzer } from './intent-analyzer.js';
import { LLMConsensusEngine } from './llm-consensus.js';
import { StdioMcpDownstream } from './mcp-downstream.js';
import { StoragePolicySource } from './policy-source.js';
import { createRequestHandler } from './router.js';

const config = loadConfig();
const auth = createAuthAdapter(config);
// ARBITER_MODE=cloud または ARBITER_USE_COSMOS=1 のときは Cosmos、
// それ以外（既定の local）は InMemory。分岐は createStorageAdapter 内部で閉じる。
const storage = await createStorageAdapter(config);
const pubsub = new InMemoryPubSubAdapter();
const llm = createLLMAdapter(config);

const policiesPath =
  process.env.ARBITER_POLICIES_FILE ?? 'packages/proxy/fixtures/default-policies.json';

const loadFromFile = async (): Promise<void> => {
  try {
    const raw = await readFile(policiesPath, 'utf8');
    const parsed = JSON.parse(raw) as { policies: Policy[] };
    for (const p of parsed.policies) await storage.upsertPolicy(p);
    process.stdout.write(
      `[arbiter-proxy] seeded ${parsed.policies.length} policies from ${policiesPath}\n`,
    );
  } catch (err) {
    process.stderr.write(
      `[arbiter-proxy] failed to load ${policiesPath}: ${err instanceof Error ? err.message : err}\n`,
    );
  }
};

const pipeline = buildPipeline({
  analyzer: new RuleBasedIntentAnalyzer(),
  policySource: new StoragePolicySource(storage),
  consensus: new LLMConsensusEngine(llm),
  decision: new DefaultDecisionEngine(llm),
});

const downstreamCommand = process.env.ARBITER_DOWNSTREAM_COMMAND;
const downstreamArgs = process.env.ARBITER_DOWNSTREAM_ARGS?.split(' ') ?? [];
let downstream: StdioMcpDownstream | undefined;

if (downstreamCommand) {
  downstream = new StdioMcpDownstream({
    command: downstreamCommand,
    args: downstreamArgs,
  });
}

const PORT = Number(process.env.PORT ?? 7071);

const server = createServer(
  createRequestHandler({
    mode: config.mode,
    auth,
    storage,
    pubsub,
    pipeline,
    ...(downstream ? { downstream } : {}),
  }),
);

await loadFromFile();

if (downstream) {
  await downstream.start();
  process.stdout.write(`[arbiter-proxy] downstream spawned: ${downstreamCommand}\n`);
}

const shutdown = async (): Promise<void> => {
  await downstream?.stop();
  server.close();
};
process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});

server.listen(PORT, () => {
  process.stdout.write(
    `[arbiter-proxy] listening on :${PORT} (mode=${config.mode}, llm=${config.llm.backend})\n`,
  );
});
