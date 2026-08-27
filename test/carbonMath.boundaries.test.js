'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateFee,
  calculateNet,
  convertFromTonnes,
  convertToTonnes,
  invariantHolds,
  normalizeQuantity,
  retirementState,
} = require('../src/utils/carbonMath');

function values(start, end, steps) {
  return Array.from({ length: steps + 1 }, (_, index) => start + ((end - start) * index) / steps);
}

test('conversion is monotonic for every supported unit', () => {
  for (const unit of ['tCO2e', 'kgCO2e', 'gCO2e']) {
    let previous = 0;
    for (const quantity of values(0.000001, 100_000, 100)) {
      const tonnes = convertToTonnes(quantity, unit);
      assert.ok(tonnes >= previous, `${unit} decreased at ${quantity}`);
      previous = tonnes;
    }
  }
});

test('fee monotonically increases with both amount and rate', () => {
  for (const amount of values(0, 1_000_000, 100)) {
    let previousRateFee = 0;
    for (let rate = 0; rate <= 10_000; rate += 100) {
      const fee = calculateFee(amount, rate);
      assert.ok(fee >= previousRateFee);
      previousRateFee = fee;
    }
  }
  for (const rate of [0, 1, 150, 5000, 10_000]) {
    let previousAmountFee = 0;
    for (const amount of values(0, 1_000_000, 100)) {
      const fee = calculateFee(amount, rate);
      assert.ok(fee >= previousAmountFee);
      previousAmountFee = fee;
    }
  }
});

test('net plus fee equals gross at representative decimal boundaries', () => {
  const amounts = [0, 0.000001, 0.01, 1.005, 99.999999, 1000.123456, 999_999.999999, 1_000_000];
  const rates = [0, 1, 99, 150, 3333, 5000, 9999, 10_000];
  for (const amount of amounts) {
    for (const rate of rates) {
      const fee = calculateFee(amount, rate);
      const net = calculateNet(amount, rate);
      assert.ok(Math.abs(amount - fee - net) <= 0.000002, `${amount} at ${rate} bps`);
    }
  }
});

test('sequential retirement never increases available supply', () => {
  for (const minted of [0, 0.000001, 1, 10.5, 9999.999999, 1_000_000]) {
    let retired = 0;
    let previousAvailable = minted;
    for (let step = 0; step < 10; step += 1) {
      const remaining = minted - retired;
      const amount = Math.floor((remaining / 2) * 1_000_000) / 1_000_000;
      const state = retirementState({ minted, retired, amount });
      assert.ok(state.available <= previousAvailable + 0.000001);
      assert.ok(invariantHolds(state));
      retired = state.retired;
      previousAvailable = state.available;
    }
  }
});

test('exactly one final retirement reaches a zero available balance', () => {
  for (const minted of [0.000001, 1, 10, 1234.56789, 1_000_000]) {
    const half = retirementState({ minted, retired: 0, amount: minted / 2 });
    const full = retirementState({ minted, retired: half.retired, amount: half.available });
    assert.equal(full.retired, minted);
    assert.equal(full.available, 0);
    assert.equal(full.retirementRate, 1);
  }
});

test('conversion supports precision edges without producing negative values', () => {
  for (const unit of ['tCO2e', 'kgCO2e', 'gCO2e']) {
    for (const quantity of [0.000001, 0.000002, 0.123456, 1.234567, 99999.999999]) {
      assert.ok(convertToTonnes(quantity, unit) >= 0);
      assert.ok(convertFromTonnes(convertToTonnes(quantity, unit), unit) >= 0);
    }
  }
});

test('normalization rejects every non-finite numeric representation', () => {
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => normalizeQuantity(value), /finite/);
  }
  for (const value of ['1', null, undefined, true, {}, []]) {
    assert.throws(() => normalizeQuantity(value), /finite/);
  }
});

test('over-retirement rejection leaves caller state unchanged', () => {
  const input = { minted: 500, retired: 499.999999, amount: 1 };
  const before = { ...input };
  assert.throws(() => retirementState(input), /exceeds available/);
  assert.deepEqual(input, before);
});

test('rate and quantity boundaries are inclusive only where documented', () => {
  assert.doesNotThrow(() => calculateFee(0, 0));
  assert.doesNotThrow(() => calculateFee(1_000_000, 10_000));
  assert.throws(() => calculateFee(-0.000001, 0), /must not be negative/);
  assert.throws(() => calculateFee(1, 10_000.000001), /between/);
  assert.throws(() => normalizeQuantity(1_000_000.000001), /cannot exceed/);
});
