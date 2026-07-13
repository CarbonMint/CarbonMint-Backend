/**
 * Zip two arrays into pairs.
 */
const zip = (a, b) => a.map((v, i) => [v, b[i]]);

module.exports = zip;
