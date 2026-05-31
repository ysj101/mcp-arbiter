import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateId } from './id.js';

test('generateId は prefix を先頭に付与する', () => {
  const id = generateId('intent');
  assert.ok(id.startsWith('intent-'), `expected to start with "intent-", got ${id}`);
});

test('generateId は呼び出しごとに一意な値を返す', () => {
  const ids = new Set(Array.from({ length: 1000 }, () => generateId('verdict')));
  assert.equal(ids.size, 1000);
});

test('generateId は prefix-timestamp-random の 3 セグメント構造を持つ', () => {
  const id = generateId('policy');
  const segments = id.split('-');
  assert.equal(segments.length, 3);
  assert.equal(segments[0], 'policy');
  assert.match(segments[1] ?? '', /^\d+$/);
  assert.match(segments[2] ?? '', /^[a-z0-9]+$/);
});
