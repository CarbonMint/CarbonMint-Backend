/**
 * Clamp a number to [0, 100].
 */
const clampPercent = (n) => Math.min(100, Math.max(0, n));

module.exports = clampPercent;
