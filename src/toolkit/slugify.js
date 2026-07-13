/**
 * Convert a string to a URL slug.
 */
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

module.exports = slugify;
