'use strict';

const assert = require('node:assert');
const { test } = require('node:test');

const percentOf = require('../../src/lib/numbers/percentOf.js');

test('percentOf returns the expected result', () => {
  assert.deepStrictEqual(percentOf(50, 200), 25);
});
