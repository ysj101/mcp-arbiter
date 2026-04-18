import type { Intent, Verdict } from '@arbiter/shared-types';

export interface DemoAgentOptions {
  proxyUrl: string;
  bearerToken?: string;
  fetchImpl?: typeof fetch;
}

export interface InvokeOptions {
  tool: string;
  parameters: Record<string, unknown>;
  traceId?: string;
}

export interface InvokeResult {
  status: number;
  intent?: Intent;
  verdict?: Verdict;
  error?: string;
}

/**
 * Small stand-in for the Microsoft Agent Framework client. In the hackathon
 * demo this is what the "planner" agent would call internally — here we
 * expose it directly so the scenarios can run without the Azure runtime.
 */
export class DemoAgentClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: DemoAgentOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async invoke(opts: InvokeOptions): Promise<InvokeResult> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.options.bearerToken) {
      headers.authorization = `Bearer ${this.options.bearerToken}`;
    }
    const res = await this.fetchImpl(`${this.options.proxyUrl}/invoke`, {
      method: 'POST',
      headers,
      body: JSON.stringify(opts),
    });

    const status = res.status;
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      return { status, error: 'invalid-response' };
    }
    const payload = body as { intent?: Intent; verdict?: Verdict; error?: string };
    if (payload?.verdict) {
      return {
        status,
        ...(payload.intent ? { intent: payload.intent } : {}),
        verdict: payload.verdict,
      };
    }
    if (status >= 400) {
      return { status, error: payload?.error ?? 'request-failed' };
    }
    return { status };
  }
}
