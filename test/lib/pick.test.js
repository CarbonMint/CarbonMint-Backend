'use strict';

const assert = require('node:assert');
const { test } = require('node:test');

const pick = require('../../src/lib/objects/pick.js');

test('pick returns the expected result', () => {
  assert.deepStrictEqual(pick({ a: 1, b: 2 }, ['a']), { a: 1 });
});
