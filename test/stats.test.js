'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { mean, min, max, median, summarize } = require('../src/utils/stats');

test('mean averages the values and rounds to 2 decimals', () => {
  assert.equal(mean([10, 20, 30]), 20);
  assert.equal(mean([1, 2]), 1.5);
});

test('mean returns 0 for an empty list', () => {
  assert.equal(mean([]), 0);
});

test('min and max return null for an empty list', () => {
  assert.equal(min([]), null);
  assert.equal(max([]), null);
});

test('min and max pick the extremes', () => {
  assert.equal(min([8.75, 12.5, 15]), 8.75);
  assert.equal(max([8.75, 12.5, 15]), 15);
});

test('median handles odd and even length lists', () => {
  assert.equal(median([1, 3, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
});

test('median returns null when there is no data', () => {
  assert.equal(median([]), null);
});

test('summarize bundles count and all measures', () => {
  assert.deepEqual(summarize([10, 20, 30]), {
    count: 3,
    min: 10,
    max: 30,
    mean: 20,
    median: 20,
  });
});
