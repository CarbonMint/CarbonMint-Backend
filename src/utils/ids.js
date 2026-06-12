'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * Identifier helpers. Domain entities use short, prefixed, human-readable ids
 * derived from a UUID so they are easy to scan in logs and API responses.
 */
function uuid() {
  return uuidv4();
}

function shortId() {
  return uuidv4().split('-')[0];
}

function prefixedId(prefix) {
  return `${prefix}_${shortId()}`;
}

module.exports = { uuid, shortId, prefixedId };
