'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { store, reset } = require('../src/store');
const reservation = require('../src/services/inventoryReservationService');

function batch(available = 10) {
  return { id: 'batch-test-1', available };
}

test.beforeEach(() => reset());

test('reservation reduces visible availability without mutating the batch', () => {
  const item = batch(10);
  const held = reservation.reserve({ batch: item, owner: 'buyer-1', quantity: 4, now: 1000, ttlMs: 100 });
  assert.equal(held.status, reservation.STATUS.HELD);
  assert.equal(item.available, 10);
  assert.equal(reservation.reservedQuantity(item.id, 1000), 4);
  assert.equal(reservation.availableQuantity(item, 1000), 6);
});

test('competing reservations cannot oversell a batch', () => {
  const item = batch(10);
  reservation.reserve({ batch: item, owner: 'buyer-1', quantity: 7, now: 1000 });
  assert.throws(
    () => reservation.reserve({ batch: item, owner: 'buyer-2', quantity: 4, now: 1000 }),
    (error) => error.statusCode === 409 && /available/.test(error.message)
  );
  assert.equal(reservation.availableQuantity(item, 1000), 3);
});

test('idempotency returns the original active reservation exactly once', () => {
  const item = batch(10);
  const first = reservation.reserve({ batch: item, owner: 'buyer-1', quantity: 4, idempotencyKey: 'same-request', now: 1000 });
  const second = reservation.reserve({ batch: item, owner: 'buyer-1', quantity: 4, idempotencyKey: 'same-request', now: 1001 });
  assert.equal(second.id, first.id);
  assert.equal(store.reservations.size, 1);
});

test('settlement consumes a held reservation and cannot be repeated', () => {
  const item = batch(10);
  const held = reservation.reserve({ batch: item, owner: 'buyer-1', quantity: 4, now: 1000 });
  const settled = reservation.settle(held.id, { now: 1100 });
  assert.equal(settled.status, reservation.STATUS.SETTLED);
  assert.equal(settled.settledAt, 1100);
  assert.equal(reservation.reservedQuantity(item.id, 1100), 0);
  assert.throws(() => reservation.settle(held.id, { now: 1101 }), /no longer active/);
});

test('settlement can retain an idempotent result for safe client retries', () => {
  const item = batch(10);
  const held = reservation.reserve({ batch: item, owner: 'buyer-1', quantity: 4, idempotencyKey: 'retry-result', now: 1000 });
  const result = { txHash: 'tx-1', quantity: 4, total: 42 };
  const settled = reservation.settle(held.id, { now: 1100, result });
  assert.deepEqual(settled.result, result);
  const repeated = reservation.reserve({ batch: item, owner: 'buyer-1', quantity: 4, idempotencyKey: 'retry-result', now: 1101 });
  assert.equal(repeated.status, reservation.STATUS.SETTLED);
  assert.deepEqual(repeated.result, result);
});

test('explicit release makes inventory available again', () => {
  const item = batch(10);
  const held = reservation.reserve({ batch: item, owner: 'buyer-1', quantity: 6, now: 1000 });
  const released = reservation.release(held.id, { now: 1200 });
  assert.equal(released.status, reservation.STATUS.RELEASED);
  assert.equal(reservation.availableQuantity(item, 1200), 10);
  assert.deepEqual(reservation.release(held.id, { now: 1300 }), released);
});

test('expired reservations are released once and return capacity', () => {
  const item = batch(10);
  const first = reservation.reserve({ batch: item, owner: 'buyer-1', quantity: 6, now: 1000, ttlMs: 100 });
  assert.equal(reservation.releaseExpired(1099), 0);
  assert.equal(reservation.releaseExpired(1100), 1);
  assert.equal(reservation.releaseExpired(1101), 0);
  assert.equal(reservation.availableQuantity(item, 1101), 10);
  assert.equal(reservation.get(first.id).releasedAt, 1100);
});

test('expired reservations cannot be settled or silently reused', () => {
  const item = batch(10);
  const held = reservation.reserve({ batch: item, owner: 'buyer-1', quantity: 6, now: 1000, ttlMs: 10 });
  assert.throws(() => reservation.settle(held.id, { now: 1010 }), /no longer active/);
  assert.equal(reservation.get(held.id).status, reservation.STATUS.RELEASED);
  const replacement = reservation.reserve({ batch: item, owner: 'buyer-2', quantity: 10, now: 1010 });
  assert.equal(replacement.status, reservation.STATUS.HELD);
});

test('settled reservations remain auditable but do not lock capacity', () => {
  const item = batch(10);
  const held = reservation.reserve({ batch: item, owner: 'buyer-1', quantity: 10, now: 1000 });
  reservation.settle(held.id, { now: 1001 });
  assert.equal(reservation.list({ batchId: item.id, status: 'settled', now: 1002 }).length, 1);
  assert.equal(reservation.availableQuantity(item, 1002), 10);
});

test('reservation filters isolate batch, owner, and status views', () => {
  const first = batch(10);
  const second = { id: 'batch-test-2', available: 10 };
  const a = reservation.reserve({ batch: first, owner: 'alice', quantity: 2, now: 1000 });
  reservation.reserve({ batch: first, owner: 'bob', quantity: 2, now: 1000 });
  const c = reservation.reserve({ batch: second, owner: 'alice', quantity: 2, now: 1000 });
  reservation.release(c.id, { now: 1001 });
  assert.equal(reservation.list({ batchId: first.id, now: 1000 }).length, 2);
  assert.equal(reservation.list({ owner: 'alice', status: 'held', now: 1000 }).length, 1);
  assert.equal(reservation.list({ status: 'released', now: 1001 }).length, 1);
  assert.equal(reservation.get(a.id).owner, 'alice');
});

test('invalid reservation inputs fail before a record is created', () => {
  const item = batch(10);
  assert.throws(() => reservation.reserve({ batch: item, owner: '', quantity: 1 }), /owner/);
  assert.throws(() => reservation.reserve({ batch: item, owner: 'a', quantity: 0 }), /positive integer/);
  assert.throws(() => reservation.reserve({ batch: item, owner: 'a', quantity: 1.5 }), /positive integer/);
  assert.throws(() => reservation.reserve({ batch: item, owner: 'a', quantity: 1, ttlMs: 0 }), /TTL/);
  assert.throws(() => reservation.reserve({ batch: item, owner: 'a', quantity: 1, ttlMs: reservation.MAX_TTL_MS + 1 }), /TTL/);
  assert.equal(store.reservations.size, 0);
});

test('unknown and invalid transitions are safe', () => {
  const item = batch(10);
  assert.throws(() => reservation.get('missing'), /not found/);
  const held = reservation.reserve({ batch: item, owner: 'buyer', quantity: 1, now: 1000 });
  assert.throws(() => reservation.release('missing'), /not found/);
  reservation.settle(held.id, { now: 1001 });
  assert.throws(() => reservation.release(held.id, { now: 1002 }), /Settled/);
});
