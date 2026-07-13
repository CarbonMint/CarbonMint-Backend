/**
 * Pick a subset of object keys.
 */
const pick = (obj, keys) => keys.reduce((o, k) => (k in obj ? ((o[k] = obj[k]), o) : o), {});

module.exports = pick;
