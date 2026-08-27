'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { reset, store } = require('../src/store');
const reservations = require('../src/services/inventoryReservationService');

function batch(id, available) {
  return { id, available };
}

function sequence(seed, count, max) {
  let value = seed >>> 0;
  return Array.from({ length: count }, () => {
    value = (Math.imul(value, 1103515245) + 12345) >>> 0;
    return (value % max) + 1;
  });
}

test.beforeEach(() => reset());

test('generated competing reservations never exceed batch inventory', () => {
  for (const inventory of [1, 2, 10, 100, 1000]) {
    const item = batch(`batch-${inventory}`, inventory);
    let held = 0;
    for (const requested of sequence(inventory + 1, 40, inventory + 4)) {
      try {
        reservations.reserve({ batch: item, owner: `buyer-${requested}`, quantity: requested, now: 1000 });
        held += requested;
      } catch (error) {
        assert.equal(error.statusCode, 409);
      }
      assert.ok(held <= inventory);
      assert.equal(reservations.reservedQuantity(item.id, 1000), held);
    }
  }
});

test('generated release and replacement sequences conserve capacity', () => {
  const item = batch('replacement-batch', 100);
  const created = [];
  for (let index = 0; index < 10; index += 1) {
    created.push(reservations.reserve({ batch: item, owner: `owner-${index}`, quantity: 10, now: 1000 }));
  }
  assert.equal(reservations.availableQuantity(item, 1000), 0);
  for (const held of created.slice(0, 5)) reservations.release(held.id, { now: 1001 });
  assert.equal(reservations.availableQuantity(item, 1001), 50);
  for (let index = 0; index < 5; index += 1) {
    reservations.reserve({ batch: item, owner: `replacement-${index}`, quantity: 10, now: 1001 });
  }
  assert.equal(reservations.availableQuantity(item, 1001), 0);
});

test('expiry sweep is idempotent across many reservation records', () => {
  const item = batch('expiry-batch', 100);
  for (let index = 0; index < 10; index += 1) {
    reservations.reserve({ batch: item, owner: `owner-${index}`, quantity: 10, now: 1000, ttlMs: index + 1 });
  }
  assert.equal(reservations.releaseExpired(1010), 10);
  assert.equal(reservations.releaseExpired(1010), 0);
  assert.equal(reservations.list({ status: reservations.STATUS.RELEASED, now: 1010 }).length, 10);
  assert.equal(reservations.availableQuantity(item, 1010), 100);
});

test('settlement and release are mutually exclusive under repeated callbacks', () => {
  for (let index = 0; index < 25; index += 1) {
    const item = batch(`callback-${index}`, 2);
    const held = reservations.reserve({ batch: item, owner: 'buyer', quantity: 1, now: 1000 });
    if (index % 2 === 0) {
      reservations.settle(held.id, { now: 1001 });
      assert.throws(() => reservations.release(held.id, { now: 1002 }), /Settled/);
    } else {
      reservations.release(held.id, { now: 1001 });
      assert.throws(() => reservations.settle(held.id, { now: 1002 }), /no longer active/);
    }
    assert.equal(reservations.get(held.id).status, index % 2 === 0 ? 'settled' : 'released');
  }
});

test('same idempotency key never creates two active inventory holds', () => {
  for (const quantity of [1, 2, 5, 10]) {
    reset();
    const item = batch(`idempotent-${quantity}`, quantity);
    const first = reservations.reserve({ batch: item, owner: 'buyer', quantity, idempotencyKey: `key-${quantity}`, now: 1000 });
    for (let retry = 0; retry < 20; retry += 1) {
      const repeated = reservations.reserve({ batch: item, owner: 'buyer', quantity, idempotencyKey: `key-${quantity}`, now: 1000 + retry });
      assert.equal(repeated.id, first.id);
    }
    assert.equal(store.reservations.size, 1);
    assert.equal(reservations.reservedQuantity(item.id, 1019), quantity);
  }
});

test('different idempotency keys remain isolated even for the same buyer', () => {
  const item = batch('key-isolation', 10);
  const first = reservations.reserve({ batch: item, owner: 'buyer', quantity: 3, idempotencyKey: 'key-a', now: 1000 });
  const second = reservations.reserve({ batch: item, owner: 'buyer', quantity: 3, idempotencyKey: 'key-b', now: 1000 });
  assert.notEqual(first.id, second.id);
  assert.equal(reservations.reservedQuantity(item.id, 1000), 6);
  assert.equal(reservations.list({ owner: 'buyer', now: 1000 }).length, 2);
});

test('capacity becomes available after each expiry boundary, not before it', () => {
  const item = batch('boundary-batch', 10);
  reservations.reserve({ batch: item, owner: 'short', quantity: 4, now: 1000, ttlMs: 10 });
  reservations.reserve({ batch: item, owner: 'long', quantity: 4, now: 1000, ttlMs: 20 });
  assert.equal(reservations.availableQuantity(item, 1009), 2);
  assert.equal(reservations.availableQuantity(item, 1010), 6);
  assert.equal(reservations.availableQuantity(item, 1019), 6);
  assert.equal(reservations.availableQuantity(item, 1020), 10);
});

test('owner and batch filters form a stable audit view after lifecycle changes', () => {
  const first = batch('audit-a', 20);
  const second = batch('audit-b', 20);
  const a = reservations.reserve({ batch: first, owner: 'alice', quantity: 5, now: 1000 });
  const b = reservations.reserve({ batch: first, owner: 'bob', quantity: 5, now: 1000 });
  const c = reservations.reserve({ batch: second, owner: 'alice', quantity: 5, now: 1000 });
  reservations.settle(a.id, { now: 1001 });
  reservations.release(c.id, { now: 1002 });
  assert.deepEqual(reservations.list({ batchId: first.id, owner: 'alice', now: 1002 }).map((x) => x.id), [a.id]);
  assert.deepEqual(reservations.list({ batchId: first.id, status: 'held', now: 1002 }).map((x) => x.id), [b.id]);
  assert.deepEqual(reservations.list({ owner: 'alice', status: 'released', now: 1002 }).map((x) => x.id), [c.id]);
});

test('reservation copies do not allow callers to rewrite state', () => {
  const item = batch('copy-batch', 10);
  const held = reservations.reserve({ batch: item, owner: 'buyer', quantity: 2, now: 1000 });
  held.status = 'settled';
  held.quantity = 1000;
  const stored = reservations.get(held.id);
  assert.equal(stored.status, 'held');
  assert.equal(stored.quantity, 2);
  assert.equal(reservations.availableQuantity(item, 1000), 8);
});

test('zero and negative inventory inputs cannot create phantom capacity', () => {
  for (const available of [0, -1, -100]) {
    const item = batch(`invalid-${available}`, available);
    assert.throws(() => reservations.reserve({ batch: item, owner: 'buyer', quantity: 1, now: 1000 }), /available/);
    assert.equal(reservations.availableQuantity(item, 1000), 0);
  }
});

test('many small reservations exactly fill inventory without fractional drift', () => {
  const item = batch('small-reservations', 1000);
  for (let index = 0; index < 1000; index += 1) {
    reservations.reserve({ batch: item, owner: `buyer-${index}`, quantity: 1, now: 1000 });
  }
  assert.equal(reservations.reservedQuantity(item.id, 1000), 1000);
  assert.equal(reservations.availableQuantity(item, 1000), 0);
  assert.equal(reservations.list({ batchId: item.id, status: 'held', now: 1000 }).length, 1000);
});

test('all settled records are excluded from active capacity after a batch-sized sale', () => {
  const item = batch('settled-capacity', 50);
  const records = [];
  for (let index = 0; index < 10; index += 1) {
    records.push(reservations.reserve({ batch: item, owner: `buyer-${index}`, quantity: 5, now: 1000 }));
  }
  for (const record of records) reservations.settle(record.id, { now: 1001 });
  assert.equal(reservations.reservedQuantity(item.id, 1001), 0);
  assert.equal(reservations.availableQuantity(item, 1001), item.available);
});

test('expired records retain immutable ownership and quantity for auditability', () => {
  const item = batch('audit-expiry', 20);
  const held = reservations.reserve({ batch: item, owner: 'audited-owner', quantity: 7, now: 5000, ttlMs: 10 });
  reservations.releaseExpired(5010);
  const released = reservations.get(held.id);
  assert.equal(released.owner, 'audited-owner');
  assert.equal(released.quantity, 7);
  assert.equal(released.createdAt, 5000);
  assert.equal(released.expiresAt, 5010);
  assert.equal(released.status, 'released');
});

test('batch availability is isolated when owners reserve identical quantities', () => {
  const first = batch('isolated-one', 8);
  const second = batch('isolated-two', 8);
  reservations.reserve({ batch: first, owner: 'owner', quantity: 8, now: 1000 });
  assert.equal(reservations.availableQuantity(first, 1000), 0);
  assert.equal(reservations.availableQuantity(second, 1000), 8);
  reservations.reserve({ batch: second, owner: 'owner', quantity: 8, now: 1000 });
  assert.equal(reservations.availableQuantity(first, 1000), 0);
  assert.equal(reservations.availableQuantity(second, 1000), 0);
});

test('reservation status values remain within the public finite state set', () => {
  const item = batch('status-set', 3);
  const held = reservations.reserve({ batch: item, owner: 'owner', quantity: 1, now: 1000 });
  assert.deepEqual(Object.values(reservations.STATUS).sort(), ['held', 'released', 'settled']);
  assert.equal(reservations.get(held.id).status, reservations.STATUS.HELD);
  const released = reservations.release(held.id, { now: 1001 });
  assert.equal(released.status, reservations.STATUS.RELEASED);
});

test('reservation timestamps preserve the supplied deterministic clock', () => {
  const item = batch('clocked', 4);
  const held = reservations.reserve({ batch: item, owner: 'owner', quantity: 1, now: 987654, ttlMs: 123 });
  assert.equal(held.createdAt, 987654);
  assert.equal(held.expiresAt, 987777);
  const released = reservations.release(held.id, { now: 987800 });
  assert.equal(released.releasedAt, 987800);
});

test('released capacity can be allocated to a different owner repeatedly', () => {
  const item = batch('recycle', 2);
  for (let index = 0; index < 20; index += 1) {
    const held = reservations.reserve({ batch: item, owner: `owner-${index}`, quantity: 2, now: index * 10 });
    reservations.release(held.id, { now: index * 10 + 1 });
    assert.equal(reservations.availableQuantity(item, index * 10 + 1), 2);
  }
  assert.equal(reservations.list({ status: reservations.STATUS.RELEASED, now: 1000 }).length, 20);
});
