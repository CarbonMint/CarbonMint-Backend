/**
 * Convert a string to snake_case.
 */
const snakeCase = (s) => s.trim().replace(/\s+/g, '_').toLowerCase();

module.exports = snakeCase;
