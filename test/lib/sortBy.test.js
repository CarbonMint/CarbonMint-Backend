'use strict';

const assert = require('node:assert');
const { test } = require('node:test');

const sortBy = require('../../src/lib/arrays/sortBy.js');

test('sortBy returns the expected result', () => {
  assert.deepStrictEqual(sortBy([{ v: 3 }, { v: 1 }], (o) => o.v), [{ v: 1 }, { v: 3 }]);
});
