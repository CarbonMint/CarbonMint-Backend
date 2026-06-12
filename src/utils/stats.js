'use strict';

const { round2 } = require('./money');

/**
 * Numeric statistics helpers. Used by market analytics to summarize a set of
 * listing prices without pulling in a stats dependency. All monetary outputs
 * are normalized to 2 decimals to match the rest of the API.
 */

/** Arithmetic mean of a list of numbers, or 0 for an empty list. */
function mean(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sum = values.reduce((acc, v) => acc + Number(v), 0);
  return round2(sum / values.length);
}

/** Smallest value in the list, or null when there is nothing to compare. */
function min(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return round2(Math.min(...values.map(Number)));
}

/** Largest value in the list, or null when there is nothing to compare. */
function max(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  return round2(Math.max(...values.map(Number)));
}

/**
 * Linear-interpolated median. Returns null for an empty list so callers can
 * distinguish "no data" from a genuine zero.
 */
function median(values) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = values.map(Number).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return round2((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return round2(sorted[mid]);
}

/** Convenience bundle of min/max/mean/median plus the sample size. */
function summarize(values) {
  return {
    count: Array.isArray(values) ? values.length : 0,
    min: min(values),
    max: max(values),
    mean: mean(values),
    median: median(values),
  };
}

module.exports = { mean, min, max, median, summarize };
