/**
 * Right-pad a value to len.
 */
const padRight = (s, len, ch = ' ') => String(s).padEnd(len, ch);

module.exports = padRight;
