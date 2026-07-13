/**
 * Left-pad a value to len.
 */
const padLeft = (s, len, ch = '0') => String(s).padStart(len, ch);

module.exports = padLeft;
