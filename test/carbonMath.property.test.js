'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateFee, calculateNet, convertFromTonnes, convertToTonnes,
  invariantHolds, normalizeQuantity, retirementState, round, UNIT_TO_TONNES,
} = require('../src/utils/carbonMath');

function generator(seed = 0x9e3779b9) {
  let state = seed >>> 0;
  return {
    next() {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    },
    int(min, max) { return min + Math.floor(this.next() * (max - min + 1)); },
    decimal(min, max, places = 6) {
      const scale = 10 ** places;
      return Math.round((min + this.next() * (max - min)) * scale) / scale;
    },
    seed() { return state >>> 0; },
  };
}

function forAll(seed, count, property) {
  const random = generator(seed);
  for (let index = 0; index < count; index += 1) property(random, index, random.seed());
}

test('quantity normalization is deterministic across generated valid quantities', () => {
  forAll(12401, 250, (random, index, failureSeed) => {
    const quantity = random.decimal(0.000001, 1_000_000, 6);
    const normalized = normalizeQuantity(quantity);
    assert.equal(normalized, round(quantity), `counterexample seed ${failureSeed} at ${index}`);
    assert.equal(normalized <= 1_000_000, true);
    assert.equal(normalized >= 0, true);
  });
});

test('unit conversion round-trips within six-decimal accounting precision', () => {
  forAll(12402, 250, (random, index, failureSeed) => {
    const unit = Object.keys(UNIT_TO_TONNES)[random.int(0, 2)];
    const quantity = random.decimal(0.000001, 100_000, 6);
    const tonnes = convertToTonnes(quantity, unit);
    const restored = convertFromTonnes(tonnes, unit);
    // Tonnes are persisted to six decimals, so converting kg back can lose at
    // most 0.001 kg and converting grams can lose at most one gram.
    const tolerance = unit === 'gCO2e' ? 1 : unit === 'kgCO2e' ? 0.0011 : 0.0000011;
    assert.ok(Math.abs(restored - quantity) <= tolerance, `counterexample seed ${failureSeed} at ${index}`);
  });
});

test('fees are monotonic, bounded, and net amounts conserve value', () => {
  forAll(12403, 250, (random, index, failureSeed) => {
    const amount = random.decimal(0, 1_000_000, 6);
    const rate = random.int(0, 10_000);
    const fee = calculateFee(amount, rate);
    const net = calculateNet(amount, rate);
    assert.ok(fee >= 0 && fee <= amount, `counterexample seed ${failureSeed} at ${index}`);
    assert.ok(net >= 0 && net <= amount, `counterexample seed ${failureSeed} at ${index}`);
    assert.ok(Math.abs((fee + net) - amount) <= 0.000002, `counterexample seed ${failureSeed} at ${index}`);
  });
});

test('retirement preserves supply conservation for generated lifecycle sequences', () => {
  forAll(12404, 200, (random, index, failureSeed) => {
    const minted = random.decimal(0, 1_000_000, 6);
    let retired = 0;
    for (let step = 0; step < 8; step += 1) {
      const remaining = minted - retired;
      const amount = remaining === 0 ? 0 : random.decimal(0, remaining, 6);
      const state = retirementState({ minted, retired, amount });
      assert.equal(invariantHolds(state), true, `counterexample seed ${failureSeed} at ${index}/${step}`);
      assert.ok(state.retired >= retired);
      assert.ok(state.available <= (minted - retired) + 0.000001);
      retired = state.retired;
    }
  });
});

test('invalid quantities, units, rates, and over-retirement reject safely', () => {
  assert.throws(() => normalizeQuantity(0), /must not be negative/);
  assert.throws(() => normalizeQuantity(-1), /must not be negative/);
  assert.throws(() => normalizeQuantity(1_000_001), /cannot exceed/);
  assert.throws(() => normalizeQuantity(Infinity), /finite/);
  assert.throws(() => convertToTonnes(1, 'lbs'), /unsupported carbon unit/);
  assert.throws(() => calculateFee(1, -1), /between 0 and 10000/);
  assert.throws(() => calculateFee(1, 10_001), /between 0 and 10000/);
  assert.throws(() => retirementState({ minted: 10, retired: 7, amount: 4 }), /exceeds available/);
  assert.throws(() => retirementState({ minted: 10, retired: 11, amount: 0 }), /cannot exceed/);
});

test('boundary fixtures cover zero, maximum quantity, and full retirement', () => {
  assert.deepEqual(retirementState({ minted: 0, retired: 0, amount: 0 }), {
    minted: 0, retired: 0, available: 0, retirementRate: 0,
  });
  const full = retirementState({ minted: 1_000_000, retired: 0, amount: 1_000_000 });
  assert.equal(full.available, 0);
  assert.equal(full.retirementRate, 1);
  assert.equal(calculateFee(1_000_000, 10_000), 1_000_000);
  assert.equal(calculateNet(1_000_000, 10_000), 0);
});

test('the seeded generator reproduces the same counterexample inputs', () => {
  const first = generator(4242);
  const second = generator(4242);
  const valuesA = Array.from({ length: 20 }, () => first.decimal(0, 1000, 6));
  const valuesB = Array.from({ length: 20 }, () => second.decimal(0, 1000, 6));
  assert.deepEqual(valuesA, valuesB);
  assert.equal(first.seed(), second.seed());
});
