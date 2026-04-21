import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  EntraIdAuthAdapter,
  extractBearerFromHeaders,
  LocalBearerAuthAdapter,
} from './auth-adapter.js';

test('LocalBearerAuthAdapter accepts matching secret', async () => {
  const adapter = new LocalBearerAuthAdapter({ sharedSecret: 's3cret' });
  const result = await adapter.verifyBearer('Bearer s3cret');
  assert.equal(result.ok, true);
  assert.equal(result.identity?.authMethod, 'bearer');
  assert.equal(result.identity?.agentId, 'local-demo-agent');
});

test('LocalBearerAuthAdapter rejects wrong secret', async () => {
  const adapter = new LocalBearerAuthAdapter({ sharedSecret: 's3cret' });
  const result = await adapter.verifyBearer('Bearer wrong');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'invalid-token');
});

test('LocalBearerAuthAdapter rejects missing token', async () => {
  const adapter = new LocalBearerAuthAdapter({ sharedSecret: 's3cret' });
  const result = await adapter.verifyBearer(undefined);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'missing-token');
});

test('EntraIdAuthAdapter passes through JWT payload', async () => {
  const adapter = new EntraIdAuthAdapter({
    tenantId: 'tenant-x',
    clientId: 'client-y',
    verifyJwt: async (token) => {
      assert.equal(token, 'ey.signed.token');
      return {
        sub: 'subject-1',
        appid: 'agent-007',
        name: 'Demo Agent',
        tid: 'tenant-x',
        scp: 'arbiter.invoke arbiter.read',
        iat: 1713456000,
        exp: 1713460000,
      };
    },
  });
  const result = await adapter.verifyBearer('Bearer ey.signed.token');
  assert.equal(result.ok, true);
  assert.equal(result.identity?.agentId, 'agent-007');
  assert.equal(result.identity?.authMethod, 'entra-id');
  assert.deepEqual(result.identity?.scopes, ['arbiter.invoke', 'arbiter.read']);
});

test('EntraIdAuthAdapter rejects tenant mismatch', async () => {
  const adapter = new EntraIdAuthAdapter({
    tenantId: 'tenant-x',
    clientId: 'client-y',
    verifyJwt: async () => ({ sub: 's', tid: 'tenant-other' }),
  });
  const result = await adapter.verifyBearer('Bearer any');
  assert.equal(result.ok, false);
  assert.equal(result.error, 'tenant-mismatch');
});

test('extractBearerFromHeaders reads Authorization header', () => {
  assert.equal(extractBearerFromHeaders({ authorization: 'Bearer x' }), 'Bearer x');
  assert.equal(extractBearerFromHeaders({ Authorization: 'Bearer y' }), 'Bearer y');
  assert.equal(extractBearerFromHeaders({}), undefined);
});
