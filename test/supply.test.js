'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  aggregateSupply,
  retirementRate,
  projectRetirement,
} = require('../src/utils/supply');

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

test('projectRetirement projects the post-retirement supply state', () => {
  assert.deepEqual(projectRetirement(1000, 200, 300), {
    projectedRetired: 500,
    remaining: 500,
    projectedRate: 0.5,
  });
});

test('projectRetirement clamps retired to never exceed minted', () => {
  assert.deepEqual(projectRetirement(1000, 900, 500), {
    projectedRetired: 1000,
    remaining: 0,
    projectedRate: 1,
  });
});

test('projectRetirement treats negative and invalid amounts as zero', () => {
  assert.deepEqual(projectRetirement(1000, 200, -50), {
    projectedRetired: 200,
    remaining: 800,
    projectedRate: 0.2,
  });
});
