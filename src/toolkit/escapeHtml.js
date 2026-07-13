/**
 * Escape HTML-special characters.
 */
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

module.exports = escapeHtml;
