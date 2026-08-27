'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const math = require('../src/utils/carbonMath');

const cases = [
  [0.000001, 0], [0.000002, 1], [0.001, 10], [0.01, 99],
  [0.1, 150], [1.005, 333], [12.345678, 1000], [99.999999, 2500],
  [1000.123456, 5000], [99999.999999, 7500], [1_000_000, 10_000],
];

test('regression matrix keeps fee output within the original amount', () => {
  for (const [amount, rate] of cases) {
    const fee = math.calculateFee(amount, rate);
    assert.ok(fee >= 0);
    assert.ok(fee <= amount);
    assert.equal(Number.isFinite(fee), true);
  }
});

test('regression matrix keeps net output non-negative', () => {
  for (const [amount, rate] of cases) {
    const net = math.calculateNet(amount, rate);
    assert.ok(net >= 0);
    assert.ok(net <= amount);
    assert.equal(Number.isFinite(net), true);
  }
});

test('all unit conversion factors match the one-tonne definition', () => {
  assert.equal(math.convertToTonnes(1, 'tCO2e'), 1);
  assert.equal(math.convertToTonnes(1000, 'kgCO2e'), 1);
  assert.equal(math.convertToTonnes(1_000_000, 'gCO2e'), 1);
  assert.equal(math.convertFromTonnes(1, 'tCO2e'), 1);
  assert.equal(math.convertFromTonnes(1, 'kgCO2e'), 1000);
  assert.equal(math.convertFromTonnes(1, 'gCO2e'), 1_000_000);
});

test('retirement state reports exact conservation at common balances', () => {
  const scenarios = [
    { minted: 100, retired: 0, amount: 25 },
    { minted: 100, retired: 25, amount: 25 },
    { minted: 100, retired: 50, amount: 49.999999 },
    { minted: 1000.123456, retired: 100.123456, amount: 900 },
  ];
  for (const scenario of scenarios) {
    const state = math.retirementState(scenario);
    assert.equal(state.minted, state.retired + state.available);
    assert.equal(math.invariantHolds(state), true);
  }
});

test('retirement rate is bounded for every valid balance', () => {
  for (let minted = 0; minted <= 1000; minted += 1) {
    for (let retired = 0; retired <= minted; retired += Math.max(1, minted / 10)) {
      const state = math.retirementState({ minted, retired, amount: 0 });
      assert.ok(state.retirementRate >= 0);
      assert.ok(state.retirementRate <= 1);
    }
  }
});

test('zero amount is accepted only for state calculations, not new quantities', () => {
  assert.equal(math.calculateFee(0, 0), 0);
  assert.equal(math.calculateNet(0, 100), 0);
  assert.deepEqual(math.retirementState({ minted: 10, retired: 4, amount: 0 }), {
    minted: 10, retired: 4, available: 6, retirementRate: 0.4,
  });
  assert.throws(() => math.normalizeQuantity(0), RangeError);
});

test('large safe values do not overflow fee arithmetic', () => {
  const amount = Number.MAX_SAFE_INTEGER - 100;
  for (const rate of [0, 1, 5000, 9999, 10_000]) {
    const fee = math.calculateFee(amount, rate);
    assert.equal(Number.isFinite(fee), true);
    assert.ok(fee >= 0 && fee <= amount);
  }
});

test('unsupported units are rejected consistently in both directions', () => {
  for (const unit of ['', 'tonne', 'tCO2', 'CO2e', 'lbs', null, undefined]) {
    assert.throws(() => math.convertToTonnes(1, unit), /unsupported carbon unit/);
    assert.throws(() => math.convertFromTonnes(1, unit), /unsupported carbon unit/);
  }
});

test('rounding never increases a six-decimal input by more than one ulp', () => {
  for (let index = 1; index <= 10000; index += 1) {
    const input = index / 1_000_000;
    const output = math.round(input);
    assert.ok(Math.abs(output - input) <= 0.0000005 + Number.EPSILON);
  }
});

test('invalid retirement requests fail before returning a partial state', () => {
  const invalid = [
    { minted: -1, retired: 0, amount: 0 },
    { minted: 10, retired: -1, amount: 0 },
    { minted: 10, retired: 0, amount: -1 },
    { minted: 10, retired: 9, amount: 2 },
    { minted: 10, retired: 11, amount: 0 },
  ];
  for (const request of invalid) assert.throws(() => math.retirementState(request));
});

test('repeated zero retirements are identity operations', () => {
  for (const minted of [0, 1, 10.123456, 1_000_000]) {
    const state = math.retirementState({ minted, retired: 0, amount: 0 });
    const repeated = math.retirementState({ minted: state.minted, retired: state.retired, amount: 0 });
    assert.deepEqual(repeated, state);
  }
});

test('full-rate fees never produce a negative rounded remainder', () => {
  for (let index = 0; index <= 1000; index += 1) {
    const amount = index / 1000;
    assert.equal(math.calculateFee(amount, 10_000), math.round(amount));
    assert.equal(math.calculateNet(amount, 10_000), 0);
  }
});

test('zero-rate fees preserve every supported positive amount', () => {
  for (const amount of [0.000001, 0.01, 1, 123.456789, 999_999.999999]) {
    assert.equal(math.calculateFee(amount, 0), 0);
    assert.equal(math.calculateNet(amount, 0), math.round(amount));
  }
});

test('converted tonnes remain within the physical unit bounds', () => {
  for (const unit of Object.keys(math.UNIT_TO_TONNES)) {
    for (const quantity of [0.000001, 0.5, 1, 100, 100_000]) {
      const tonnes = math.convertToTonnes(quantity, unit);
      assert.ok(tonnes >= 0);
      assert.ok(Number.isFinite(tonnes));
    }
  }
});

test('near-limit quantities are accepted after normalization but overflow is rejected', () => {
  assert.equal(math.normalizeQuantity(999_999.999999), 999_999.999999);
  assert.equal(math.normalizeQuantity(1_000_000), 1_000_000);
  assert.throws(() => math.normalizeQuantity(1_000_000.000001), RangeError);
  assert.throws(() => math.normalizeQuantity(Number.MAX_VALUE), RangeError);
});

test('the invariant helper rejects malformed externally supplied states', () => {
  assert.equal(math.invariantHolds({ minted: 10, retired: 4, available: 6 }), true);
  assert.equal(math.invariantHolds({ minted: 10, retired: 5, available: 6 }), false);
  assert.equal(math.invariantHolds({ minted: 10, retired: 11, available: -1 }), false);
  assert.equal(math.invariantHolds({ minted: -1, retired: 0, available: 1 }), false);
});

test('property runner inputs stay stable when the same seed is replayed', () => {
  const samples = (seed) => {
    let value = seed >>> 0;
    return Array.from({ length: 12 }, () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 0x100000000;
    });
  };
  assert.deepEqual(samples(124), samples(124));
  assert.notDeepEqual(samples(124), samples(125));
});

test('retirement rate never changes when no credits are retired', () => {
  for (const minted of [0, 0.000001, 1, 100, 1_000_000]) {
    assert.equal(math.retirementState({ minted, retired: 0, amount: 0 }).retirementRate, 0);
  }
});
