'use strict';

const { store } = require('../store');
const { prefixedId } = require('../utils/ids');
const ApiError = require('../utils/ApiError');

const STATUS = Object.freeze({ HELD: 'held', SETTLED: 'settled', RELEASED: 'released' });
const DEFAULT_TTL_MS = 30_000;
const MAX_TTL_MS = 15 * 60_000;

// Reservation records are intentionally retained after settlement or release.
// Retention makes settlement retries and expiry audits explainable while the
// active-quantity calculation counts only unexpired held records. All state
// transitions happen synchronously in this in-memory adapter, matching the
// atomic section a database implementation must protect with a transaction.
// Callers perform the external transfer only after a hold succeeds and settle
// it only after the provider accepts the transfer. Provider failures release
// the hold, ensuring retries cannot consume inventory twice.
// Idempotency keys make client retries safe.
// Expiry boundaries are tested with injected clocks.

function clock(now) {
  const value = now === undefined ? Date.now() : Number(now);
  if (!Number.isFinite(value) || value < 0) throw new TypeError('now must be a non-negative timestamp');
  return value;
}

function ensureStore() {
  if (!store.reservations || typeof store.reservations.set !== 'function') store.reservations = new Map();
  return store.reservations;
}

function active(reservation, at = Date.now()) {
  return reservation.status === STATUS.HELD && reservation.expiresAt > at;
}

function releaseExpired(now = Date.now()) {
  const at = clock(now);
  let released = 0;
  for (const reservation of ensureStore().values()) {
    if (active(reservation, at)) continue;
    if (reservation.status === STATUS.HELD) {
      reservation.status = STATUS.RELEASED;
      reservation.releasedAt = at;
      released += 1;
    }
  }
  return released;
}

function reservedQuantity(batchId, now = Date.now()) {
  const at = clock(now);
  releaseExpired(at);
  let quantity = 0;
  for (const reservation of ensureStore().values()) {
    if (reservation.batchId === batchId && active(reservation, at)) quantity += reservation.quantity;
  }
  return quantity;
}

function availableQuantity(batch, now = Date.now()) {
  if (!batch || !batch.id) throw new TypeError('batch is required');
  return Math.max(0, batch.available - reservedQuantity(batch.id, now));
}

function reserve({ batch, owner, quantity, idempotencyKey, now, ttlMs = DEFAULT_TTL_MS } = {}) {
  if (!batch || !batch.id) throw new TypeError('batch is required');
  if (!owner || typeof owner !== 'string') throw ApiError.badRequest('reservation owner is required');
  if (!Number.isInteger(quantity) || quantity <= 0) throw ApiError.badRequest('reservation quantity must be a positive integer');
  const ttl = Number(ttlMs);
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > MAX_TTL_MS) throw ApiError.badRequest('reservation TTL is out of bounds');
  const at = clock(now);
  const reservations = ensureStore();
  releaseExpired(at);
  if (idempotencyKey) {
    const existing = Array.from(reservations.values()).find((item) => item.idempotencyKey === idempotencyKey);
    if (existing && active(existing, at)) return { ...existing };
    if (existing && existing.status === STATUS.SETTLED) return { ...existing };
  }
  const available = availableQuantity(batch, at);
  if (quantity > available) throw ApiError.conflict(`Only ${available} credits are available for reservation`);
  const reservation = {
    id: prefixedId('reservation'), batchId: batch.id, owner, quantity,
    idempotencyKey: idempotencyKey || null, status: STATUS.HELD,
    createdAt: at, expiresAt: at + ttl, settledAt: null, releasedAt: null,
  };
  reservations.set(reservation.id, reservation);
  return { ...reservation };
}

function get(id) {
  const reservation = ensureStore().get(id);
  if (!reservation) throw ApiError.notFound(`Reservation ${id} not found`);
  return { ...reservation };
}

function requireHeld(id, now = Date.now()) {
  const at = clock(now);
  const reservation = ensureStore().get(id);
  if (!reservation) throw ApiError.notFound(`Reservation ${id} not found`);
  if (!active(reservation, at)) {
    if (reservation.status === STATUS.HELD) {
      reservation.status = STATUS.RELEASED;
      reservation.releasedAt = at;
    }
    throw ApiError.conflict(`Reservation ${id} is no longer active`);
  }
  return reservation;
}

function settle(id, { now, result } = {}) {
  const at = clock(now);
  const reservation = requireHeld(id, at);
  reservation.status = STATUS.SETTLED;
  reservation.settledAt = at;
  if (result !== undefined) reservation.result = { ...result };
  return { ...reservation };
}

function release(id, { now } = {}) {
  const at = clock(now);
  const reservation = ensureStore().get(id);
  if (!reservation) throw ApiError.notFound(`Reservation ${id} not found`);
  if (reservation.status === STATUS.SETTLED) throw ApiError.conflict('Settled reservations cannot be released');
  if (reservation.status === STATUS.RELEASED) return { ...reservation };
  reservation.status = STATUS.RELEASED;
  reservation.releasedAt = at;
  return { ...reservation };
}

function list(filter = {}) {
  const at = clock(filter.now);
  releaseExpired(at);
  return Array.from(ensureStore().values())
    .filter((item) => !filter.batchId || item.batchId === filter.batchId)
    .filter((item) => !filter.owner || item.owner === filter.owner)
    .filter((item) => !filter.status || item.status === filter.status)
    .map((item) => ({ ...item }));
}

module.exports = {
  DEFAULT_TTL_MS, MAX_TTL_MS, STATUS, active, availableQuantity,
  get, list, release, releaseExpired, reserve, reservedQuantity, settle,
};
