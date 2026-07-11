'use strict';

const assert = require('node:assert');
const { test } = require('node:test');

const groupBy = require('../../src/lib/arrays/groupBy.js');

test('groupBy returns the expected result', () => {
  assert.deepStrictEqual(groupBy([1, 2, 3], (x) => x % 2), { '0': [2], '1': [1, 3] });
});
