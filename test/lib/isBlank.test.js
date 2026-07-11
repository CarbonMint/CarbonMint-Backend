'use strict';

const assert = require('node:assert');
const { test } = require('node:test');

const isBlank = require('../../src/lib/strings/isBlank.js');

test('isBlank returns the expected result', () => {
  assert.deepStrictEqual(isBlank('   '), true);
});
