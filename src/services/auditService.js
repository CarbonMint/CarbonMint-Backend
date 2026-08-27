'use strict';

const { store } = require('../store');
const { prefixedId } = require('../utils/ids');

const MAX_KEYS = 24;
const MAX_TEXT = 256;
const SENSITIVE = /(secret|token|password|credential|private.?key|mnemonic)/i;

function redact(value, depth = 0) {
  if (depth > 3) return '[TRUNCATED]';
  if (typeof value === 'string') return value.slice(0, MAX_TEXT);
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, MAX_KEYS).map((item) => redact(item, depth + 1));
  return Object.entries(value).slice(0, MAX_KEYS).reduce((out, [key, item]) => {
    out[key] = SENSITIVE.test(key) ? '[REDACTED]' : redact(item, depth + 1);
    return out;
  }, {});
}

function record({ actor, action, target, correlationId, outcome = 'success', metadata = {} }) {
  const event = {
    id: prefixedId('audit'),
    version: 1,
    actor: String(actor || 'system').slice(0, MAX_TEXT),
    action: String(action).slice(0, MAX_TEXT),
    target: String(target).slice(0, MAX_TEXT),
    correlationId: String(correlationId || 'unknown').slice(0, MAX_TEXT),
    outcome: outcome === 'failure' ? 'failure' : 'success',
    metadata: redact(metadata),
    occurredAt: new Date().toISOString(),
  };
  store.auditEvents.set(event.id, event);
  return event;
}

function list({ actor, target, correlationId, limit = 100, offset = 0 } = {}) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 100, 100));
  const safeOffset = Math.max(0, Number(offset) || 0);
  const all = Array.from(store.auditEvents.values())
    .filter((event) => !actor || event.actor === actor)
    .filter((event) => !target || event.target === target)
    .filter((event) => !correlationId || event.correlationId === correlationId)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return {
    events: all.slice(safeOffset, safeOffset + safeLimit),
    pagination: { total: all.length, limit: safeLimit, offset: safeOffset, hasMore: safeOffset + safeLimit < all.length },
  };
}

module.exports = { record, list, redact };
