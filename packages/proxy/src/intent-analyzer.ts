import type { Intent, IntentExtractedContext, IntentScope } from '@arbiter/shared-types';

export interface AnalyzeInput {
  agentId: string;
  tool: string;
  parameters: Readonly<Record<string, unknown>>;
  traceId?: string;
}

export interface IntentAnalyzer {
  analyze(input: AnalyzeInput): Promise<Intent>;
}

const INTERNAL_DOMAINS = ['example.com', 'arbiter.local'];
const SENSITIVE_KEYWORDS = [
  '人事',
  '評価',
  '給与',
  '個人情報',
  '機密',
  'confidential',
  'salary',
  'merger',
  'M&A',
  'api key',
  'apikey',
  'password',
];

const classifyRecipient = (recipient: string): IntentScope => {
  const at = recipient.indexOf('@');
  if (at < 0) return 'unknown';
  const domain = recipient.slice(at + 1).toLowerCase();
  return INTERNAL_DOMAINS.includes(domain) ? 'internal' : 'external';
};

export const extractRecipients = (params: Record<string, unknown>): string[] => {
  const out: string[] = [];
  const candidateKeys = ['to', 'recipient', 'recipients', 'cc', 'bcc'];
  for (const key of candidateKeys) {
    const value = params[key];
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) {
      for (const v of value) if (typeof v === 'string') out.push(v);
    }
  }
  return out;
};

export const scoreSensitivity = (haystack: string): 'low' | 'medium' | 'high' => {
  const lower = haystack.toLowerCase();
  let hits = 0;
  for (const kw of SENSITIVE_KEYWORDS) if (lower.includes(kw.toLowerCase())) hits += 1;
  if (hits >= 2) return 'high';
  if (hits === 1) return 'medium';
  return 'low';
};

export const summarizeScope = (recipients: readonly string[]): IntentScope => {
  if (recipients.length === 0) return 'unknown';
  const scopes = new Set(recipients.map(classifyRecipient));
  if (scopes.has('external')) return 'external';
  if (scopes.has('internal') && scopes.size === 1) return 'internal';
  return 'unknown';
};

export const extractContext = (
  tool: string,
  parameters: Record<string, unknown>,
): IntentExtractedContext => {
  const recipients = extractRecipients(parameters);
  const body = typeof parameters.body === 'string' ? parameters.body : '';
  const subject = typeof parameters.subject === 'string' ? parameters.subject : '';
  const sensitivityHint = scoreSensitivity(`${subject}\n${body}`);
  const scope = summarizeScope(recipients);

  const targetResource = tool === 'send_email' ? 'email-outbox' : tool;
  return {
    targetResource,
    ...(recipients.length > 0 ? { recipients } : {}),
    sensitivityHint,
    scope,
  };
};

export class RuleBasedIntentAnalyzer implements IntentAnalyzer {
  async analyze(input: AnalyzeInput): Promise<Intent> {
    const now = new Date().toISOString();
    const intentId = `intent-${now}-${Math.random().toString(36).slice(2, 10)}`;
    const extractedContext = extractContext(input.tool, { ...input.parameters });
    return {
      intentId,
      agentId: input.agentId,
      tool: input.tool,
      parameters: input.parameters,
      extractedContext,
      createdAt: now,
      ...(input.traceId ? { traceId: input.traceId } : {}),
    };
  }
}
