/**
 * Clamp n to the inclusive range [lo, hi].
 */
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);

module.exports = clamp;
