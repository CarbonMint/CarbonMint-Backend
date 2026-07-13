/**
 * Omit keys from an object.
 */
const omit = (obj, keys) => Object.fromEntries(Object.entries(obj).filter(([k]) => !keys.includes(k)));

module.exports = omit;
