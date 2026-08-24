'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { store, reset } = require('../src/store');
const auditService = require('../src/services/auditService');

test.beforeEach(() => reset());

test('audit events use a versioned schema and redact sensitive metadata', () => {
  const event = auditService.record({
    actor: 'admin_platform',
    action: 'batch.mint',
    target: 'batch-1',
    correlationId: 'req-1',
    metadata: { quantity: 10, providerToken: 'secret-value' },
  });
  assert.equal(event.version, 1);
  assert.equal(event.metadata.providerToken, '[REDACTED]');
  assert.equal(store.auditEvents.size, 1);
});

test('audit queries filter by actor, target and correlation id', () => {
  auditService.record({ actor: 'a', action: 'x', target: 'batch-1', correlationId: 'r1' });
  auditService.record({ actor: 'b', action: 'y', target: 'batch-2', correlationId: 'r2' });
  const result = auditService.list({ actor: 'a', target: 'batch-1', correlationId: 'r1' });
  assert.equal(result.pagination.total, 1);
  assert.equal(result.events[0].action, 'x');
});
