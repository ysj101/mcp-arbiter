import { strict as assert } from 'node:assert';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import type { Intent } from '@arbiter/shared-types';
import { ClaudeCliLLMAdapter } from './claude-cli-llm-adapter.js';

interface FakeChild extends EventEmitter {
  stdout: PassThrough;
  stderr: PassThrough;
  kill: (signal?: string) => boolean;
}

const createFakeChild = (): FakeChild => {
  const emitter = new EventEmitter() as FakeChild;
  emitter.stdout = new PassThrough();
  emitter.stderr = new PassThrough();
  emitter.kill = () => true;
  return emitter;
};

const makeIntent = (overrides: Partial<Intent> = {}): Intent => ({
  intentId: 'intent-1',
  agentId: 'agent-a',
  tool: 'send_email',
  parameters: { to: 'out@partner.co.jp', subject: '人事評価', body: 'x' },
  extractedContext: {
    recipients: ['out@partner.co.jp'],
    scope: 'external',
    sensitivityHint: 'high',
  },
  createdAt: '2026-04-18T00:00:00.000Z',
  ...overrides,
});

const successPayload = (structured: unknown): string =>
  JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: 'dummy text',
    structured_output: structured,
  });

test('ClaudeCliLLMAdapter.judge parses structured_output into SubAgentOpinion', async () => {
  let capturedArgs: readonly string[] = [];
  const adapter = new ClaudeCliLLMAdapter({
    spawn: (_cmd, args) => {
      capturedArgs = args;
      const child = createFakeChild();
      process.nextTick(() => {
        child.stdout.write(
          successPayload({
            verdict: 'deny',
            confidence: 0.91,
            rationale: '社外宛先への人事情報送信は許容できない。',
          }),
        );
        child.stdout.end();
        child.emit('close', 0);
      });
      return child as never;
    },
  });

  const opinion = await adapter.judge({
    intent: makeIntent(),
    role: 'privacy-officer',
    systemPrompt: 'あなたはプライバシーオフィサー。',
  });

  assert.equal(opinion.subAgentId, 'claude-privacy-officer');
  assert.equal(opinion.role, 'privacy-officer');
  assert.equal(opinion.verdict, 'deny');
  assert.equal(opinion.confidence, 0.91);
  assert.match(opinion.rationale, /社外宛先/);

  // 主要フラグが付与されていること
  assert.ok(capturedArgs.includes('--output-format'));
  assert.ok(capturedArgs.includes('json'));
  assert.ok(capturedArgs.includes('--json-schema'));
  assert.ok(capturedArgs.includes('--system-prompt'));
  assert.ok(capturedArgs.includes('-p'));
  assert.ok(capturedArgs.includes('--no-session-persistence'));
  assert.ok(capturedArgs.includes('--strict-mcp-config'));
});

test('ClaudeCliLLMAdapter.judge rejects invalid verdict enum', async () => {
  const adapter = new ClaudeCliLLMAdapter({
    spawn: () => {
      const child = createFakeChild();
      process.nextTick(() => {
        child.stdout.write(successPayload({ verdict: 'maybe', confidence: 0.5, rationale: 'x' }));
        child.stdout.end();
        child.emit('close', 0);
      });
      return child as never;
    },
  });

  await assert.rejects(
    adapter.judge({
      intent: makeIntent(),
      role: 'hr-leader',
      systemPrompt: 'sp',
    }),
    /invalid verdict/,
  );
});

test('ClaudeCliLLMAdapter throws when structured_output missing', async () => {
  const adapter = new ClaudeCliLLMAdapter({
    spawn: () => {
      const child = createFakeChild();
      process.nextTick(() => {
        child.stdout.write(
          JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'x' }),
        );
        child.stdout.end();
        child.emit('close', 0);
      });
      return child as never;
    },
  });

  await assert.rejects(
    adapter.judge({
      intent: makeIntent(),
      role: 'infosec',
      systemPrompt: 'sp',
    }),
    /structured_output/,
  );
});

test('ClaudeCliLLMAdapter throws when claude CLI exits with non-zero', async () => {
  const adapter = new ClaudeCliLLMAdapter({
    spawn: () => {
      const child = createFakeChild();
      process.nextTick(() => {
        child.stderr.write('Not logged in');
        child.stderr.end();
        child.stdout.end();
        child.emit('close', 1);
      });
      return child as never;
    },
  });

  await assert.rejects(
    adapter.judge({
      intent: makeIntent(),
      role: 'privacy-officer',
      systemPrompt: 'sp',
    }),
    /exited with code 1.*Not logged in/s,
  );
});

test('ClaudeCliLLMAdapter.compose returns trimmed text result', async () => {
  const adapter = new ClaudeCliLLMAdapter({
    spawn: () => {
      const child = createFakeChild();
      process.nextTick(() => {
        child.stdout.write(
          JSON.stringify({
            type: 'result',
            subtype: 'success',
            is_error: false,
            result: '  主文: 本法廷は...を許可する。\n ',
          }),
        );
        child.stdout.end();
        child.emit('close', 0);
      });
      return child as never;
    },
  });

  const judgment = await adapter.compose('dummy prompt');
  assert.match(judgment, /^主文:/);
  assert.ok(!judgment.endsWith(' '));
});

test('ClaudeCliLLMAdapter.runClaude enforces timeout', async () => {
  const adapter = new ClaudeCliLLMAdapter({
    timeoutMs: 30,
    spawn: () => createFakeChild() as never, // never emits close
  });

  await assert.rejects(
    adapter.judge({
      intent: makeIntent(),
      role: 'privacy-officer',
      systemPrompt: 'sp',
    }),
    /timed out after 30ms/,
  );
});
