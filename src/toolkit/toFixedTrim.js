/**
 * Fixed decimals without trailing zeros.
 */
const toFixedTrim = (n, d = 2) => parseFloat(n.toFixed(d));

module.exports = toFixedTrim;
