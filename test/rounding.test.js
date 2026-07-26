const { test } = require('node:test');
const assert = require('node:assert');
const { roundCurrency } = require('../src/utils/rounding');

test('roundCurrency: standard rounding behavior', () => {
    assert.strictEqual(roundCurrency(1.005, 2), 1.01);
    assert.strictEqual(roundCurrency(1.004, 2), 1.00);
});

test('roundCurrency: precision edge cases (Number.EPSILON)', () => {
    // 0.1 + 0.2 is typically 0.30000000000000004
    // Rounding to 1 decimal place should be 0.3
    assert.strictEqual(roundCurrency(0.1 + 0.2, 1), 0.3);
});

test('roundCurrency: edge cases (integers, negative numbers, zero)', () => {
    assert.strictEqual(roundCurrency(100, 2), 100);
    assert.strictEqual(roundCurrency(-1.005, 2), -1.01);
    assert.strictEqual(roundCurrency(0, 2), 0);
});

test('roundCurrency: input validation', () => {
    assert.throws(() => roundCurrency('1.005'), TypeError);
    assert.throws(() => roundCurrency(null), TypeError);
    assert.throws(() => roundCurrency(undefined), TypeError);
    assert.throws(() => roundCurrency(NaN), TypeError);
});
