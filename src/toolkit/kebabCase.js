/**
 * Convert a string to kebab-case.
 */
const kebabCase = (s) => s.trim().replace(/\s+/g, '-').toLowerCase();

module.exports = kebabCase;
