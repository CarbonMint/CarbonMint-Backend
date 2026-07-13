/**
 * Percentage of part relative to whole.
 */
const percent = (part, whole) => whole === 0 ? 0 : (part / whole) * 100;

module.exports = percent;
