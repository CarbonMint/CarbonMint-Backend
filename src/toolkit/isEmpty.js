/**
 * True if a value is empty.
 */
const isEmpty = (v) => v == null || (typeof v === 'object' ? Object.keys(v).length === 0 : String(v).length === 0);

module.exports = isEmpty;
