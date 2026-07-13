/**
 * Split an array into chunks of size.
 */
const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

module.exports = chunk;
