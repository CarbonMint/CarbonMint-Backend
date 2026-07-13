/**
 * Count words in a string.
 */
const wordCount = (s) => s.trim() ? s.trim().split(/\s+/).length : 0;

module.exports = wordCount;
