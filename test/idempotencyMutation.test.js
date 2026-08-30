'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { store, reset } = require('../src/store');
const ApiError = require('../src/utils/ApiError');
const { executeIdempotent, listAuditEvents } = require('../src/services/idempotencyService');
const { seed, SEED_BATCHES } = require('../src/store/seed');
const batchService = require('../src/services/batchService');
const marketService = require('../src/services/marketService');
const retirementService = require('../src/services/retirementService');
const holdingsService = require('../src/services/holdingsService');

test.beforeEach(reset);

test('same scoped key returns the terminal result and writes one audit event', () => {
  let executions = 0;
  const first = executeIdempotent({
    actor: 'issuer-1', command: 'mint', key: 'mint-key-1', payload: { amount: 10, project: 'p1' },
    execute: () => ({ txHash: `tx-${++executions}`, amount: 10 }),
  });
  const retry = executeIdempotent({
    actor: 'issuer-1', command: 'mint', key: 'mint-key-1', payload: { project: 'p1', amount: 10 },
    execute: () => ({ txHash: `tx-${++executions}`, amount: 10 }),
  });

  assert.deepEqual(retry, first);
  assert.equal(executions, 1);
  assert.equal(store.idempotencyRecords.size, 1);
  assert.equal(listAuditEvents().length, 1);
});

test('same key with a changed payload is a typed conflict', () => {
  executeIdempotent({ actor: 'buyer', command: 'buy', key: 'buy-key-1', payload: { quantity: 1 }, execute: () => 'receipt' });
  assert.throws(
    () => executeIdempotent({ actor: 'buyer', command: 'buy', key: 'buy-key-1', payload: { quantity: 2 }, execute: () => 'wrong' }),
    (error) => error instanceof ApiError && error.code === 'IDEMPOTENCY_CONFLICT' && error.statusCode === 409,
  );
});

test('scope includes actor and command so keys cannot cross mutation boundaries', () => {
  const mint = executeIdempotent({ actor: 'same', command: 'mint', key: 'shared-key', payload: { a: 1 }, execute: () => 'mint' });
  const buy = executeIdempotent({ actor: 'same', command: 'buy', key: 'shared-key', payload: { a: 1 }, execute: () => 'buy' });
  const otherActor = executeIdempotent({ actor: 'other', command: 'mint', key: 'shared-key', payload: { a: 1 }, execute: () => 'other' });
  assert.deepEqual([mint, buy, otherActor], ['mint', 'buy', 'other']);
  assert.equal(store.idempotencyRecords.size, 3);
});

test('invalid keys fail before a mutation can run', () => {
  let called = false;
  assert.throws(() => executeIdempotent({ actor: 'a', command: 'mint', key: 'short', payload: {}, execute: () => { called = true; } }), /Idempotency-Key/);
  assert.equal(called, false);
});

test('failed mutations are not cached as terminal results', () => {
  assert.throws(() => executeIdempotent({ actor: 'a', command: 'mint', key: 'retryable-key', payload: {}, execute: () => { throw new Error('provider failed'); } }), /provider failed/);
  const result = executeIdempotent({ actor: 'a', command: 'mint', key: 'retryable-key', payload: {}, execute: () => 'recovered' });
  assert.equal(result, 'recovered');
  assert.equal(listAuditEvents().length, 1);
});

test.describe('mutation services', () => {
  test.beforeEach(() => {
    reset();
    seed();
  });

  test('mint returns the original batch on a repeated key', () => {
    const request = {
      projectId: 'proj_amazon',
      quantity: 250,
      vintage: 2026,
      owner: 'issuer_amazon',
      pricePerCredit: 12.5,
      idempotencyKey: 'mint-service-001',
    };
    const first = batchService.mintBatch(request);
    const retry = batchService.mintBatch({ ...request, pricePerCredit: 12.5 });

    assert.equal(retry.id, first.id);
    assert.equal(retry.txHash, first.txHash);
    assert.equal(store.batches.size, SEED_BATCHES.length + 1);
    assert.equal(holdingsService.getBalance('issuer_amazon', first.id), 250);
    assert.equal(listAuditEvents().filter((event) => event.command === 'mint').length, 1);
  });

  test('mint rejects a key reused with a different quantity before creating supply', () => {
    const request = {
      projectId: 'proj_amazon',
      quantity: 250,
      vintage: 2026,
      owner: 'issuer_amazon',
      idempotencyKey: 'mint-service-002',
    };
    batchService.mintBatch(request);
    assert.throws(
      () => batchService.mintBatch({ ...request, quantity: 251 }),
      (error) => error.statusCode === 409 && error.code === 'IDEMPOTENCY_CONFLICT',
    );
    assert.equal(store.batches.size, SEED_BATCHES.length + 1);
  });

  test('buy returns the original receipt and moves holdings once', () => {
    const batch = store.batches.get(SEED_BATCHES[0].id);
    const request = {
      batchId: batch.id,
      buyer: 'buyer_alice',
      quantity: 40,
      idempotencyKey: 'buy-service-001',
    };
    const first = marketService.buy(request);
    const retry = marketService.buy(request);

    assert.deepEqual(retry, first);
    assert.equal(batch.available, batch.quantity - 40);
    assert.equal(holdingsService.getBalance('buyer_alice', batch.id), 40);
    assert.equal(holdingsService.getBalance(batch.owner, batch.id), batch.quantity - 40);
    assert.equal(listAuditEvents().filter((event) => event.command === 'buy').length, 1);
  });

  test('buy isolates the same key between buyers', () => {
    const batch = store.batches.get(SEED_BATCHES[0].id);
    const common = { batchId: batch.id, quantity: 5, idempotencyKey: 'buy-service-002' };
    marketService.buy({ ...common, buyer: 'buyer_alice' });
    marketService.buy({ ...common, buyer: 'buyer_bob' });

    assert.equal(holdingsService.getBalance('buyer_alice', batch.id), 5);
    assert.equal(holdingsService.getBalance('buyer_bob', batch.id), 5);
    assert.equal(listAuditEvents().filter((event) => event.command === 'buy').length, 2);
  });

  test('retire accepts the new key and does not burn twice', () => {
    const batchId = SEED_BATCHES[0].id;
    const request = {
      batchId,
      user: 'issuer_amazon',
      quantity: 20,
      beneficiary: 'climate-claim',
      reason: 'Contract test',
      idempotencyKey: 'retire-service-001',
    };
    const first = retirementService.retire(request);
    const retry = retirementService.retire(request);

    assert.equal(retry.id, first.id);
    assert.equal(store.certificates.size, 1);
    assert.equal(holdingsService.getBalance('issuer_amazon', batchId), 9980);
    assert.equal(listAuditEvents().filter((event) => event.command === 'retire').length, 1);
  });

  test('retirement conflict does not alter certificate or batch state', () => {
    const request = {
      batchId: SEED_BATCHES[0].id,
      user: 'issuer_amazon',
      quantity: 20,
      beneficiary: 'claim-a',
      reason: 'Contract test',
      idempotencyKey: 'retire-service-002',
    };
    retirementService.retire(request);
    assert.throws(
      () => retirementService.retire({ ...request, beneficiary: 'claim-b' }),
      (error) => error.statusCode === 409 && error.code === 'IDEMPOTENCY_CONFLICT',
    );
    assert.equal(store.certificates.size, 1);
    assert.equal(store.batches.get(request.batchId).retired, 20);
  });

  test('failed validation does not reserve a key', () => {
    const request = {
      projectId: 'missing-project',
      quantity: 10,
      vintage: 2026,
      owner: 'issuer_amazon',
      idempotencyKey: 'mint-service-003',
    };
    assert.throws(() => batchService.mintBatch(request), (error) => error.statusCode === 404);
    assert.equal(store.idempotencyRecords.size, 0);
  });

  test('synchronous concurrent callers converge on one mint result', async () => {
    const request = {
      projectId: 'proj_solar_in',
      quantity: 75,
      vintage: 2026,
      owner: 'issuer_solar',
      idempotencyKey: 'mint-service-004',
    };
    const results = await Promise.all([
      Promise.resolve().then(() => batchService.mintBatch(request)),
      Promise.resolve().then(() => batchService.mintBatch(request)),
      Promise.resolve().then(() => batchService.mintBatch(request)),
    ]);

    assert.equal(new Set(results.map((result) => result.id)).size, 1);
    assert.equal(store.batches.size, SEED_BATCHES.length + 1);
    assert.equal(listAuditEvents().length, 1);
  });

  test('keys are not shared between commands even for identical payloads', () => {
    const batch = store.batches.get(SEED_BATCHES[0].id);
    const key = 'shared-service-key';
    const mint = batchService.mintBatch({
      projectId: 'proj_kenya_cook', quantity: 5, vintage: 2026, owner: 'issuer_kenya', idempotencyKey: key,
    });
    const buy = marketService.buy({ batchId: batch.id, buyer: 'buyer_alice', quantity: 5, idempotencyKey: key });

    assert.notEqual(mint.id, buy.batchId);
    assert.equal(listAuditEvents().length, 2);
  });

  test('legacy retirementId remains compatible through the shared idempotency record', () => {
    const request = {
      batchId: SEED_BATCHES[0].id,
      user: 'issuer_amazon',
      quantity: 3,
      beneficiary: 'legacy-claim',
      reason: 'Legacy compatibility',
      retirementId: 'legacy-retirement-001',
    };
    const first = retirementService.retire(request);
    const retry = retirementService.retire(request);

    assert.equal(retry.id, first.id);
    assert.equal(store.certificates.size, 1);
    assert.equal(listAuditEvents().filter((event) => event.command === 'retire').length, 1);
  });
});
