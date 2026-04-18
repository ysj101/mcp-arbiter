#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import {
  InMemoryPubSubAdapter,
  createAuthAdapter,
  createLLMAdapter,
  createStorageAdapter,
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
  const rawUrl = req.url ?? '/';
  const parsed = new URL(rawUrl, `http://${req.headers.host ?? 'localhost'}`);
  const pathname = parsed.pathname;
  const method = req.method ?? 'GET';

  if (pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, mode: config.mode, downstream: Boolean(downstream) }));
    return;
  }

  // GET /verdicts[?decision=&agentId=&limit=]
  if (pathname === '/verdicts' && method === 'GET') {
    const decision = parsed.searchParams.get('decision');
    const agentId = parsed.searchParams.get('agentId');
    const limitRaw = parsed.searchParams.get('limit');
    const verdicts = await storage.listVerdicts({
      ...(decision === 'allow' || decision === 'deny' ? { decision } : {}),
      ...(agentId ? { agentId } : {}),
      ...(limitRaw ? { limit: Number(limitRaw) } : {}),
    });
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ verdicts }));
    return;
  }

  // GET /verdicts/:verdictId
  if (pathname.startsWith('/verdicts/') && method === 'GET') {
    const verdictId = decodeURIComponent(pathname.slice('/verdicts/'.length));
    const verdict = await storage.getVerdict(verdictId);
    if (!verdict) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not-found' }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ verdict }));
    return;
  }

  // GET /policies[?enabled=true|false]
  if (pathname === '/policies' && method === 'GET') {
    const enabledRaw = parsed.searchParams.get('enabled');
    const query =
      enabledRaw === 'true' ? { enabled: true } : enabledRaw === 'false' ? { enabled: false } : {};
    const policies = await storage.listPolicies(query);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ policies }));
    return;
  }

  // POST /policies — 新規 upsert
  if (pathname === '/policies' && method === 'POST') {
    const body = (await readBody(req)) as Partial<Policy> | null;
    if (!body || !body.name || !body.action) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'name and action are required' }));
      return;
    }
    const now = new Date().toISOString();
    const policy: Policy = {
      policyId: body.policyId ?? `policy-${Date.now()}`,
      name: body.name,
      description: body.description ?? '',
      sensitiveCategories: body.sensitiveCategories ?? [],
      rules: body.rules ?? [],
      ...(body.llmJudgePrompt ? { llmJudgePrompt: body.llmJudgePrompt } : {}),
      action: body.action,
      enabled: body.enabled ?? true,
      createdAt: body.createdAt ?? now,
      updatedAt: now,
      version: (body.version ?? 0) + 1,
    };
    const saved = await storage.upsertPolicy(policy);
    res.writeHead(201, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ policy: saved }));
    return;
  }

  // GET /policies/:policyId
  if (pathname.startsWith('/policies/') && method === 'GET') {
    const policyId = decodeURIComponent(pathname.slice('/policies/'.length));
    const policy = await storage.getPolicy(policyId);
    if (!policy) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not-found' }));
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ policy }));
    return;
  }

  // PUT /policies/:policyId — 既存に対して部分更新
  if (pathname.startsWith('/policies/') && method === 'PUT') {
    const policyId = decodeURIComponent(pathname.slice('/policies/'.length));
    const body = (await readBody(req)) as Partial<Policy> | null;
    const existing = await storage.getPolicy(policyId);
    if (!existing) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not-found' }));
      return;
    }
    const merged: Policy = {
      ...existing,
      ...(body ?? {}),
      policyId,
      updatedAt: new Date().toISOString(),
      version: existing.version + 1,
    };
    const saved = await storage.upsertPolicy(merged);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ policy: saved }));
    return;
  }

  // DELETE /policies/:policyId
  if (pathname.startsWith('/policies/') && method === 'DELETE') {
    const policyId = decodeURIComponent(pathname.slice('/policies/'.length));
    await storage.deletePolicy(policyId);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // GET /events — SSE. Dashboard / CLI tail の入り口。
  if (pathname === '/events' && method === 'GET') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    });
    res.write(':connected\n\n');
    const unsubscribe = pubsub.subscribe((event) => {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    });
    const heartbeat = setInterval(() => {
      res.write(':heartbeat\n\n');
    }, 15000);
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
    return;
  }

  if (pathname !== '/invoke') {
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
        method,
        url: rawUrl,
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
