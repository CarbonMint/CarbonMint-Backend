'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { store, reset, queueDepth } = require('../src/store');

// Seed helper: add batches with the given statuses to the store.
function seedBatches(batches) {
  for (const b of batches) {
    store.batches.set(b.id, {
      id: b.id,
      status: b.status,
      quantity: b.quantity || 100,
      available: b.available || 100,
      retired: b.retired || 0,
    });
  }
}

test.beforeEach(() => {
  reset();
});

test('queueDepth returns empty object when store has no batches', () => {
  assert.deepEqual(queueDepth(), {});
});

test('queueDepth counts a single active batch', () => {
  seedBatches([{ id: 'b1', status: 'active' }]);
  assert.deepEqual(queueDepth(), { active: 1 });
});

test('queueDepth counts batches by status across multiple statuses', () => {
  seedBatches([
    { id: 'b1', status: 'active' },
    { id: 'b2', status: 'active' },
    { id: 'b3', status: 'sold-out' },
    { id: 'b4', status: 'retired' },
    { id: 'b5', status: 'retired' },
  ]);
  assert.deepEqual(queueDepth(), { active: 2, 'sold-out': 1, retired: 2 });
});

test('queueDepth reflects changes after a batch is added', () => {
  seedBatches([{ id: 'b1', status: 'active' }]);
  assert.deepEqual(queueDepth(), { active: 1 });

  store.batches.set('b2', { id: 'b2', status: 'active' });
  assert.deepEqual(queueDepth(), { active: 2 });
});

test('queueDepth reflects changes after a batch is removed', () => {
  seedBatches([{ id: 'b1', status: 'active' }, { id: 'b2', status: 'active' }]);
  assert.deepEqual(queueDepth(), { active: 2 });

  store.batches.delete('b1');
  assert.deepEqual(queueDepth(), { active: 1 });
});
