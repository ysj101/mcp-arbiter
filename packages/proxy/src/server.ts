#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import {
  InMemoryPubSubAdapter,
  InMemoryStorageAdapter,
  createAuthAdapter,
  createLLMAdapter,
  loadConfig,
} from '@arbiter/core';
import type { Policy } from '@arbiter/shared-types';
import { buildPipeline } from './arbitrate.js';
import { DefaultDecisionEngine } from './decision-engine.js';
import { handleInvokeRequest } from './http-handler.js';
import { RuleBasedIntentAnalyzer } from './intent-analyzer.js';
import { LLMConsensusEngine } from './llm-consensus.js';
import { StdioMcpDownstream } from './mcp-downstream.js';
import { FilePolicySource, StoragePolicySource } from './policy-source.js';

const config = loadConfig();
const auth = createAuthAdapter(config);
const storage = new InMemoryStorageAdapter();
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

void FilePolicySource;

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

const readBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
};

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = req.url ?? '/';
  if (url === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, mode: config.mode, downstream: Boolean(downstream) }));
    return;
  }
  if (url !== '/invoke') {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not-found' }));
    return;
  }
  try {
    const body = await readBody(req);
    const result = await handleInvokeRequest(
      {
        auth,
        storage,
        pubsub,
        pipeline,
        ...(downstream ? { downstream } : {}),
      },
      {
        method: req.method ?? 'GET',
        url,
        headers: req.headers as Record<string, string | string[] | undefined>,
        body,
      },
    );
    res.writeHead(result.status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(result.body));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    process.stderr.write(`[arbiter-proxy] invoke failed: ${message}\n`);
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'internal-error', detail: message }));
  }
});

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
