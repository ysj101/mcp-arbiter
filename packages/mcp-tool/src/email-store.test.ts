import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { DummyEmailStore } from './email-store.js';
import { validateSendEmailInput } from './tool-definition.js';

test('DummyEmailStore records and lists emails', () => {
  const store = new DummyEmailStore();
  const rec = store.record({ to: 'a@example.com', subject: 'Hi', body: 'Hello' });
  assert.equal(store.size(), 1);
  assert.equal(store.list()[0]?.to, 'a@example.com');
  assert.ok(rec.recordedAt);
});

test('validateSendEmailInput accepts well-formed input', () => {
  const result = validateSendEmailInput({ to: 'a@b.com', subject: 's', body: 'b' });
  assert.equal(result.to, 'a@b.com');
});

test('validateSendEmailInput rejects missing fields', () => {
  assert.throws(() => validateSendEmailInput({ subject: 's', body: 'b' }));
  assert.throws(() => validateSendEmailInput({ to: '', subject: 's', body: 'b' }));
  assert.throws(() => validateSendEmailInput(null));
});
