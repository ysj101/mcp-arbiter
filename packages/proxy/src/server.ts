#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import {
  InMemoryPubSubAdapter,
  InMemoryStorageAdapter,
  MockLLMAdapter,
  createAuthAdapter,
  loadConfig,
} from '@arbiter/core';
import type { Policy } from '@arbiter/shared-types';
import { buildPipeline } from './arbitrate.js';
import { DefaultDecisionEngine } from './decision-engine.js';
import { handleInvokeRequest } from './http-handler.js';
import { RuleBasedIntentAnalyzer } from './intent-analyzer.js';
import { LLMConsensusEngine } from './llm-consensus.js';
import { FilePolicySource, StoragePolicySource } from './policy-source.js';

const config = loadConfig();
const auth = createAuthAdapter(config);
const storage = new InMemoryStorageAdapter();
const pubsub = new InMemoryPubSubAdapter();

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
  consensus: new LLMConsensusEngine(new MockLLMAdapter()),
  decision: new DefaultDecisionEngine(),
});

// FilePolicySource is also exported for tests / other entrypoints.
void FilePolicySource;

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
    res.end(JSON.stringify({ ok: true, mode: config.mode }));
    return;
  }
  if (url !== '/invoke') {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not-found' }));
    return;
  }
  const body = await readBody(req);
  const result = await handleInvokeRequest(
    { auth, storage, pubsub, pipeline },
    {
      method: req.method ?? 'GET',
      url,
      headers: req.headers as Record<string, string | string[] | undefined>,
      body,
    },
  );
  res.writeHead(result.status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(result.body));
});

await loadFromFile();

server.listen(PORT, () => {
  process.stdout.write(`[arbiter-proxy] listening on :${PORT} (mode=${config.mode})\n`);
});
