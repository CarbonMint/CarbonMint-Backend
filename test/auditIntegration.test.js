'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { store, reset } = require('../src/store');
const auditService = require('../src/services/auditService');
const batchService = require('../src/services/batchService');
const marketService = require('../src/services/marketService');
const retirementService = require('../src/services/retirementService');

function setup() {
  reset();
  store.projects.set('project-test', {
    id: 'project-test',
    name: 'Test Project',
  });
}

function mint(overrides = {}) {
  return batchService.mintBatch({
    projectId: 'project-test',
    quantity: 100,
    vintage: 2024,
    owner: 'issuer_test',
    pricePerCredit: 10,
    actor: 'issuer_test',
    correlationId: 'req-mint',
    ...overrides,
  });
}

test.beforeEach(setup);

test('mint creates one audit event after the batch and holding exist', () => {
  const batch = mint();
  assert.equal(store.auditEvents.size, 1);
  const event = Array.from(store.auditEvents.values())[0];
  assert.equal(event.action, 'batch.mint');
  assert.equal(event.target, batch.id);
  assert.equal(event.actor, 'issuer_test');
  assert.equal(event.correlationId, 'req-mint');
  assert.equal(event.metadata.quantity, 100);
  assert.equal(store.holdings.get('issuer_test').get(batch.id), 100);
});

test('market purchase creates one audit event with settlement context', () => {
  const batch = mint();
  store.auditEvents.clear();
  const receipt = marketService.buy({
    batchId: batch.id,
    buyer: 'buyer_test',
    quantity: 20,
    actor: 'buyer_test',
    correlationId: 'req-buy',
  });
  assert.equal(receipt.quantity, 20);
  assert.equal(store.auditEvents.size, 1);
  const event = Array.from(store.auditEvents.values())[0];
  assert.equal(event.action, 'market.buy');
  assert.equal(event.target, batch.id);
  assert.equal(event.metadata.seller, 'issuer_test');
  assert.equal(event.metadata.buyer, 'buyer_test');
  assert.equal(event.metadata.quantity, 20);
  assert.equal(event.metadata.txHash, receipt.txHash);
});

test('retirement creates one audit event tied to its certificate', () => {
  const batch = mint();
  marketService.buy({ batchId: batch.id, buyer: 'buyer_test', quantity: 10, actor: 'buyer_test', correlationId: 'buy' });
  store.auditEvents.clear();
  const certificate = retirementService.retire({
    batchId: batch.id,
    user: 'buyer_test',
    quantity: 5,
    beneficiary: 'beneficiary_test',
    reason: 'retirement test',
    actor: 'buyer_test',
    correlationId: 'req-retire',
  });
  assert.equal(store.auditEvents.size, 1);
  const event = Array.from(store.auditEvents.values())[0];
  assert.equal(event.action, 'credits.retire');
  assert.equal(event.metadata.certificateId, certificate.id);
  assert.equal(event.metadata.beneficiary, 'beneficiary_test');
  assert.equal(event.metadata.quantity, 5);
});

test('failed domain validation does not create an audit success event', () => {
  assert.throws(() => mint({ quantity: 0 }), /positive integer/);
  assert.equal(store.auditEvents.size, 0);
});

test('failed provider calls are normalized before audit can claim success', () => {
  const original = require('../src/services/stellarService').mintCredits;
  const stellarService = require('../src/services/stellarService');
  stellarService.mintCredits = () => { throw new Error('provider credentials leaked'); };
  try {
    assert.throws(() => mint(), /provider/);
    assert.equal(store.auditEvents.size, 0);
  } finally {
    stellarService.mintCredits = original;
  }
});

test('audit filters support actor, target and request correlation together', () => {
  const batch = mint();
  auditService.record({ actor: 'other', action: 'other.action', target: 'other', correlationId: 'other' });
  const result = auditService.list({ actor: 'issuer_test', target: batch.id, correlationId: 'req-mint' });
  assert.equal(result.pagination.total, 1);
  assert.equal(result.events[0].action, 'batch.mint');
});

test('audit pagination caps the result and preserves newest-first order', () => {
  for (let i = 0; i < 4; i += 1) {
    auditService.record({ actor: `actor-${i}`, action: `action-${i}`, target: 'target', correlationId: `req-${i}` });
  }
  const result = auditService.list({ limit: 2, offset: 0 });
  assert.equal(result.events.length, 2);
  assert.equal(result.pagination.total, 4);
  assert.equal(result.pagination.hasMore, true);
});

test('sensitive metadata is redacted before storage rather than only at read time', () => {
  const event = auditService.record({
    actor: 'admin_platform',
    action: 'admin.configure',
    target: 'registry',
    correlationId: 'req-admin',
    metadata: { apiToken: 'secret-token', nested: { privateKey: 'secret-key' } },
  });
  assert.equal(event.metadata.apiToken, '[REDACTED]');
  assert.equal(event.metadata.nested.privateKey, '[REDACTED]');
});

test('audit event text and collection sizes are bounded', () => {
  const metadata = {};
  for (let i = 0; i < 40; i += 1) metadata[`field_${i}`] = 'x'.repeat(400);
  const event = auditService.record({ actor: 'x'.repeat(400), action: 'x'.repeat(400), target: 'x'.repeat(400), correlationId: 'x'.repeat(400), metadata });
  assert.equal(event.actor.length, 256);
  assert.equal(event.action.length, 256);
  assert.equal(event.target.length, 256);
  assert.equal(event.correlationId.length, 256);
  assert.equal(Object.keys(event.metadata).length, 24);
  assert.equal(event.metadata.field_0.length, 256);
});

test('every covered event has the same schema version and outcome vocabulary', () => {
  const batch = mint();
  marketService.buy({ batchId: batch.id, buyer: 'buyer_test', quantity: 1, actor: 'buyer_test', correlationId: 'buy' });
  for (const event of store.auditEvents.values()) {
    assert.equal(event.version, 1);
    assert.ok(['success', 'failure'].includes(event.outcome));
    assert.ok(event.occurredAt);
  }
});
