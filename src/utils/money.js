'use strict';

/**
 * Money helpers. Prices in CarbonMint are quoted in USDC with 2 decimal
 * precision. Amounts are kept as numbers but normalized through these helpers
 * to avoid floating point drift in API responses.
 */
function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function multiply(price, quantity) {
  return round2(Number(price) * Number(quantity));
}

function applyBps(amount, bps) {
  return round2((Number(amount) * Number(bps)) / 10000);
}

function format(amount, currency = 'USDC') {
  return `${round2(amount).toFixed(2)} ${currency}`;
}

module.exports = { round2, multiply, applyBps, format };
