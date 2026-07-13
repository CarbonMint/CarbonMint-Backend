/**
 * Truncate a string to len characters.
 */
const truncate = (s, len, suffix = '...') => s.length > len ? s.slice(0, len) + suffix : s;

module.exports = truncate;
