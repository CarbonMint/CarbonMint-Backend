'use strict';

const crypto = require('crypto');
const { store } = require('../store');
const ApiError = require('../utils/ApiError');

const KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function canonicalize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  return Object.keys(value).sort().reduce((result, key) => {
    result[key] = canonicalize(value[key]);
    return result;
  }, {});
}

function fingerprint(payload) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(canonicalize(payload)))
    .digest('hex');
}

function assertKey(key) {
  if (typeof key !== 'string' || !KEY_PATTERN.test(key)) {
    throw ApiError.badRequest('Idempotency-Key must be 8-128 safe characters');
  }
}

function recordKey(actor, command, key) {
  return `${actor}\u0000${command}\u0000${key}`;
}

/**
 * Execute one synchronous mutation exactly once for a scoped client key.
 * Results are retained as terminal values, so a retry returns the same object
 * identity and does not call an external provider a second time.
 */
function executeIdempotent({ actor, command, key, payload, execute }) {
  assertKey(key);
  const scopedKey = recordKey(actor, command, key);
  const requestFingerprint = fingerprint(payload);
  const previous = store.idempotencyRecords.get(scopedKey);

  if (previous) {
    if (previous.fingerprint !== requestFingerprint) {
      const conflict = ApiError.conflict('Idempotency key was reused with a different payload');
      conflict.code = 'IDEMPOTENCY_CONFLICT';
      throw conflict;
    }
    return previous.result;
  }

  const result = execute();
  store.idempotencyRecords.set(scopedKey, {
    actor,
    command,
    key,
    fingerprint: requestFingerprint,
    result,
    createdAt: new Date().toISOString(),
  });
  store.auditEvents.push({
    actor,
    command,
    key,
    fingerprint: requestFingerprint,
    createdAt: new Date().toISOString(),
  });
  return result;
}

function listAuditEvents() {
  return store.auditEvents.map((event) => ({ ...event }));
}

module.exports = { executeIdempotent, fingerprint, listAuditEvents };
