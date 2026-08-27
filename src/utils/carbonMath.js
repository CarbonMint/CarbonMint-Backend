'use strict';

const { MAX_BATCH_QUANTITY } = require('../config/constants');

const SCALE = 1_000_000;
const UNIT_TO_TONNES = Object.freeze({
  'tCO2e': 1,
  kgCO2e: 0.001,
  gCO2e: 0.000001,
});

// All public helpers use tonnes as the canonical accounting unit. Inputs are
// normalized before arithmetic, which gives callers a stable six-decimal
// boundary and keeps conversion behavior independent of JavaScript's binary
// floating-point representation. The property suite intentionally exercises
// both the canonical unit and the smaller display units.
//
// Fees are represented in basis points and are bounded to a full 100%.
// Retirement is rejected when the requested amount exceeds available supply.
// These rules are shared by mint, marketplace, and retirement workflows.
// A deterministic generator records seeds so a failing property is replayable.
// No randomized test relies on wall-clock time or external registry state.
// This makes CI failures actionable for contributors and maintainers.

function assertFinite(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number`);
  }
}

function round(value, decimals = 6) {
  assertFinite(value, 'value');
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

function normalizeQuantity(value, { max = MAX_BATCH_QUANTITY, allowZero = false } = {}) {
  assertFinite(value, 'quantity');
  if ((!allowZero && value <= 0) || (allowZero && value < 0)) {
    throw new RangeError('quantity must not be negative or zero');
  }
  if (value > max) throw new RangeError(`quantity cannot exceed ${max}`);
  return round(value);
}

function convertToTonnes(quantity, unit) {
  if (!Object.prototype.hasOwnProperty.call(UNIT_TO_TONNES, unit)) {
    throw new RangeError(`unsupported carbon unit: ${unit}`);
  }
  const normalized = normalizeQuantity(quantity, { max: Number.MAX_SAFE_INTEGER, allowZero: true });
  return round(normalized * UNIT_TO_TONNES[unit]);
}

function convertFromTonnes(tonnes, unit) {
  if (!Object.prototype.hasOwnProperty.call(UNIT_TO_TONNES, unit)) {
    throw new RangeError(`unsupported carbon unit: ${unit}`);
  }
  const normalized = normalizeQuantity(tonnes, { max: Number.MAX_SAFE_INTEGER, allowZero: true });
  return round(normalized / UNIT_TO_TONNES[unit]);
}

function calculateFee(amount, rateBps) {
  const value = normalizeQuantity(amount, { max: Number.MAX_SAFE_INTEGER, allowZero: true });
  assertFinite(rateBps, 'rateBps');
  if (rateBps < 0 || rateBps > 10_000) throw new RangeError('rateBps must be between 0 and 10000');
  return round((value * rateBps) / 10_000);
}

function calculateNet(amount, rateBps) {
  const gross = normalizeQuantity(amount, { max: Number.MAX_SAFE_INTEGER, allowZero: true });
  return round(gross - calculateFee(gross, rateBps));
}

function retirementState({ minted, retired, amount }) {
  const total = normalizeQuantity(minted, { max: Number.MAX_SAFE_INTEGER, allowZero: true });
  const alreadyRetired = normalizeQuantity(retired, { max: total, allowZero: true });
  const requested = normalizeQuantity(amount, { max: Number.MAX_SAFE_INTEGER, allowZero: true });
  if (alreadyRetired > total) throw new RangeError('retired quantity cannot exceed minted quantity');
  if (requested > total - alreadyRetired) throw new RangeError('retirement exceeds available credits');
  const nextRetired = round(alreadyRetired + requested);
  return {
    minted: total,
    retired: nextRetired,
    available: round(total - nextRetired),
    retirementRate: total === 0 ? 0 : round(nextRetired / total),
  };
}

function invariantHolds(state) {
  return state.minted >= 0 && state.retired >= 0 && state.available >= 0 &&
    state.retired <= state.minted && Math.abs((state.retired + state.available) - state.minted) <= 1 / SCALE;
}

module.exports = {
  SCALE, UNIT_TO_TONNES, calculateFee, calculateNet, convertFromTonnes,
  convertToTonnes, invariantHolds, normalizeQuantity, retirementState, round,
};
