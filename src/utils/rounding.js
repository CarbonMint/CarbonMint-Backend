/**
 * Utility for precise currency rounding.
 * 
 * Uses Number.EPSILON to handle floating-point arithmetic precision issues.
 * 
 * @param {number} value - The numerical currency value to round.
 * @param {number} [decimals=2] - The number of decimal places to round to.
 * @returns {number} The rounded value.
 * @throws {TypeError} If value is not a number.
 */
function roundCurrency(value, decimals = 2) {
    if (typeof value !== 'number' || isNaN(value)) {
        throw new TypeError('Value must be a number');
    }

    const factor = Math.pow(10, decimals);
    // Use Math.sign to handle negative numbers correctly with epsilon
    return Math.round((Math.abs(value) + Number.EPSILON) * factor) / factor * Math.sign(value);
}

module.exports = { roundCurrency };
