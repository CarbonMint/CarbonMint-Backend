/**
 * Insert thousands separators.
 */
const formatThousands = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

module.exports = formatThousands;
