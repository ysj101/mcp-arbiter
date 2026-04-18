import { type ChildProcess, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';

export interface SpawnDownstreamOptions {
  command: string;
  args?: readonly string[];
  env?: Record<string, string>;
}

export interface McpDownstreamInterface {
  start(): Promise<void>;
  listTools(): Promise<McpToolDescription[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult>;
  stop(): Promise<void>;
}

export interface McpToolDescription {
  name: string;
  description?: string;
}

export interface McpCallResult {
  content: readonly { type: string; text: string }[];
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

/**
 * Spawns a downstream MCP server as a child process and talks JSON-RPC over stdio.
 *
 * By spawning it here, the downstream server is never bound to a network port,
 * so external callers cannot bypass the Arbiter Proxy.
 */
export class StdioMcpDownstream implements McpDownstreamInterface {
  private child?: ChildProcess;
  private readonly pending = new Map<string | number, PendingRequest>();
  private buffer = '';
  private started = false;

  constructor(private readonly options: SpawnDownstreamOptions) {}

  async start(): Promise<void> {
    if (this.started) return;
    const child = spawn(this.options.command, this.options.args ?? [], {
      stdio: ['pipe', 'pipe', 'inherit'],
      env: { ...process.env, ...(this.options.env ?? {}) },
    });
    this.child = child;
    child.stdout?.setEncoding('utf8');
    child.stdout?.on('data', (chunk: string) => this.handleData(chunk));
    child.on('exit', () => {
      for (const [, p] of this.pending) p.reject(new Error('downstream exited'));
      this.pending.clear();
      this.started = false;
    });

    await this.request('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: '@arbiter/proxy', version: '0.1.0' },
    });
    this.notify('notifications/initialized');
    this.started = true;
  }

  async listTools(): Promise<McpToolDescription[]> {
    const result = (await this.request('tools/list', {})) as { tools: McpToolDescription[] };
    return result.tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult> {
    const result = (await this.request('tools/call', {
      name,
      arguments: args,
    })) as McpCallResult;
    return result;
  }

  async stop(): Promise<void> {
    const child = this.child;
    if (!child) return;
    child.kill('SIGTERM');
    try {
      await Promise.race([once(child, 'exit'), new Promise((r) => setTimeout(r, 1000))]);
    } catch {
      /* noop */
    }
    this.started = false;
  }

  private async request(method: string, params: unknown): Promise<unknown> {
    if (!this.child?.stdin) throw new Error('downstream not started');
    const id = randomUUID();
    const payload = { jsonrpc: '2.0', id, method, params };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child?.stdin?.write(`${JSON.stringify(payload)}\n`);
    });
  }

  private notify(method: string): void {
    if (!this.child?.stdin) return;
    const payload = { jsonrpc: '2.0', method };
    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  private handleData(chunk: string): void {
    this.buffer += chunk;
    let idx = this.buffer.indexOf('\n');
    while (idx >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (line) this.dispatch(line);
      idx = this.buffer.indexOf('\n');
    }
  }

  private dispatch(line: string): void {
    let parsed: {
      id?: string | number;
      result?: unknown;
      error?: { message?: string };
    };
    try {
      parsed = JSON.parse(line);
    } catch {
      return;
    }
    if (parsed.id === undefined) return;
    const pending = this.pending.get(parsed.id);
    if (!pending) return;
    this.pending.delete(parsed.id);
    if (parsed.error) {
      pending.reject(new Error(parsed.error.message ?? 'mcp-error'));
    } else {
      pending.resolve(parsed.result);
    }
  }
}
