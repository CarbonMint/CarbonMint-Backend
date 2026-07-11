'use strict';

const assert = require('node:assert');
const { test } = require('node:test');

const clamp = require('../../src/lib/numbers/clamp.js');

test('clamp returns the expected result', () => {
  assert.deepStrictEqual(clamp(5, 0, 3), 3);
});
