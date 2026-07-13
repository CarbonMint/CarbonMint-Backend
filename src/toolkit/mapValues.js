/**
 * Map an object's values.
 */
const mapValues = (obj, fn) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)]));

module.exports = mapValues;
