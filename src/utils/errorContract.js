'use strict';

/**
 * Versioned public error contract.
 *
 * Every error returned by the HTTP API is shaped by this module. Keeping the
 * mapping in one place prevents controllers from leaking provider-specific
 * messages and gives clients a stable field to branch on.
 */
const ERROR_VERSION = 'v1';
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const PROVIDER_CODES = new Set([
  'TIMEOUT',
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'RATE_LIMITED',
  'UNAVAILABLE',
]);

function isRetryableStatus(status) {
  return RETRYABLE_STATUS_CODES.has(status);
}

function sanitizeText(value, fallback) {
  if (typeof value !== 'string' || value.trim() === '') return fallback;
  return value.trim().slice(0, 256);
}

function sanitizeDetails(details) {
  if (details === undefined || details === null) return null;
  if (Array.isArray(details)) {
    return {
      fields: details
        .filter((item) => typeof item === 'string')
        .slice(0, 50)
        .map((item) => item.slice(0, 256)),
    };
  }
  if (typeof details !== 'object') return { value: String(details).slice(0, 256) };

  return Object.entries(details).slice(0, 25).reduce((out, [key, value]) => {
    const safeKey = String(key).slice(0, 64);
    if (/secret|token|password|credential|private.?key/i.test(safeKey)) {
      out[safeKey] = '[REDACTED]';
    } else if (typeof value === 'string') {
      out[safeKey] = value.slice(0, 256);
    } else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      out[safeKey] = value;
    } else {
      out[safeKey] = '[REDACTED]';
    }
    return out;
  }, {});
}

function providerCode(error) {
  const raw = error && (error.code || error.providerCode || error.statusCode);
  if (typeof raw === 'number') return `PROVIDER_${raw}`;
  if (typeof raw === 'string' && PROVIDER_CODES.has(raw.toUpperCase())) {
    return `PROVIDER_${raw.toUpperCase()}`;
  }
  return 'PROVIDER_UNAVAILABLE';
}

function normalizeProviderError(error) {
  const code = providerCode(error);
  const retryable = code !== 'PROVIDER_RATE_LIMITED' || true;
  return {
    statusCode: code === 'PROVIDER_RATE_LIMITED' ? 429 : 503,
    code,
    message: code === 'PROVIDER_RATE_LIMITED'
      ? 'The upstream provider rate limit was reached'
      : 'The upstream provider is temporarily unavailable',
    retryable,
    details: {
      providerCode: typeof error?.code === 'string' ? error.code.slice(0, 64) : undefined,
    },
  };
}

function toPayload(error, correlationId) {
  const status = Number(error?.statusCode || error?.status) || 500;
  const operational = error?.isOperational === true;
  const message = operational
    ? sanitizeText(error.message, 'Request failed')
    : status >= 500
      ? 'Internal Server Error'
      : sanitizeText(error?.message, 'Request failed');
  return {
    version: ERROR_VERSION,
    code: sanitizeText(error?.code, status >= 500 ? 'INTERNAL_ERROR' : 'ERROR'),
    message,
    status,
    retryable: error?.retryable === undefined ? isRetryableStatus(status) : Boolean(error.retryable),
    correlationId: sanitizeText(correlationId, null),
    details: sanitizeDetails(error?.details),
  };
}

module.exports = {
  ERROR_VERSION,
  RETRYABLE_STATUS_CODES,
  isRetryableStatus,
  sanitizeDetails,
  normalizeProviderError,
  toPayload,
};
