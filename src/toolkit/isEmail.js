/**
 * Basic email format check.
 */
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

module.exports = isEmail;
