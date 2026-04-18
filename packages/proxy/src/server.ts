#!/usr/bin/env node
import { type IncomingMessage, type ServerResponse, createServer } from 'node:http';
import {
  InMemoryPubSubAdapter,
  InMemoryStorageAdapter,
  createAuthAdapter,
  loadConfig,
} from '@arbiter/core';
import { createSkeletonPipeline } from './arbitrate.js';
import { handleInvokeRequest } from './http-handler.js';

const config = loadConfig();
const auth = createAuthAdapter(config);
const storage = new InMemoryStorageAdapter();
const pubsub = new InMemoryPubSubAdapter();
const pipeline = createSkeletonPipeline();

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

server.listen(PORT, () => {
  process.stdout.write(`[arbiter-proxy] listening on :${PORT} (mode=${config.mode})\n`);
});
