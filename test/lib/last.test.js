'use strict';

const assert = require('node:assert');
const { test } = require('node:test');

const last = require('../../src/lib/arrays/last.js');

test('last returns the expected result', () => {
  assert.deepStrictEqual(last([1, 2, 3]), 3);
});
