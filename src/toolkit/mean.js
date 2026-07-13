/**
 * Arithmetic mean of an array.
 */
const mean = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

module.exports = mean;
