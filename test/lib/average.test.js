'use strict';

const assert = require('node:assert');
const { test } = require('node:test');

const average = require('../../src/lib/numbers/average.js');

test('average returns the expected result', () => {
  assert.deepStrictEqual(average([1, 2, 3]), 2);
});
