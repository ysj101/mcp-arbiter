import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isCloud, isLocal, loadConfig } from './config.js';

test('loadConfig defaults to local mode', () => {
  const cfg = loadConfig({});
  assert.equal(cfg.mode, 'local');
  assert.equal(isLocal(cfg), true);
  assert.equal(isCloud(cfg), false);
});

test('loadConfig reads ARBITER_MODE=cloud', () => {
  const cfg = loadConfig({ ARBITER_MODE: 'cloud' });
  assert.equal(cfg.mode, 'cloud');
  assert.equal(isCloud(cfg), true);
});

test('loadConfig treats unknown mode as local', () => {
  const cfg = loadConfig({ ARBITER_MODE: 'staging' });
  assert.equal(cfg.mode, 'local');
});
