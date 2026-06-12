'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { aggregateSupply, retirementRate } = require('../src/utils/supply');

test('aggregateSupply sums minted, retired and available across batches', () => {
  const batches = [
    { quantity: 1000, retired: 200, available: 800 },
    { quantity: 500, retired: 0, available: 500 },
  ];
  assert.deepEqual(aggregateSupply(batches), {
    minted: 1500,
    retired: 200,
    available: 1300,
  });
});

test('aggregateSupply returns zeros for an empty batch list', () => {
  assert.deepEqual(aggregateSupply([]), {
    minted: 0,
    retired: 0,
    available: 0,
  });
});

test('retirementRate computes the retired fraction', () => {
  assert.equal(retirementRate(1000, 250), 0.25);
});

test('retirementRate returns 0 when nothing has been minted', () => {
  assert.equal(retirementRate(0, 0), 0);
});
