'use strict';

const assert = require('node:assert');
const { test } = require('node:test');

const unique = require('../../src/lib/arrays/unique.js');

test('unique returns the expected result', () => {
  assert.deepStrictEqual(unique([1, 1, 2]), [1, 2]);
});
