/**
 * First n items of an array.
 */
const take = (arr, n) => arr.slice(0, Math.max(0, n));

module.exports = take;
