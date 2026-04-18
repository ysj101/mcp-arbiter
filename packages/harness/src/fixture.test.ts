import { strict as assert } from 'node:assert';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadDataset } from './fixture.js';

const here = dirname(fileURLToPath(import.meta.url));

test('loadDataset reads v1 fixture and validates', async () => {
  const path = join(here, '..', '..', '..', 'harness', 'fixtures', 'policy-engine.v1.json');
  const ds = await loadDataset(path);
  assert.ok(ds.cases.length >= 20, `expected >=20 cases, got ${ds.cases.length}`);
  const ids = new Set(ds.cases.map((c) => c.id));
  assert.equal(ids.size, ds.cases.length, 'ids must be unique');
  for (const c of ds.cases) {
    assert.ok(
      c.expected_decision === 'allow' || c.expected_decision === 'deny',
      `unexpected decision in ${c.id}`,
    );
  }
});
