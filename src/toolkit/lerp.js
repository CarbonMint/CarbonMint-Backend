/**
 * Linear interpolation between a and b by factor t.
 */
const lerp = (a, b, t) => a + (b - a) * t;

module.exports = lerp;
