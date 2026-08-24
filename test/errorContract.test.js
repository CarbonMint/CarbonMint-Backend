'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const ApiError = require('../src/utils/ApiError');
const contract = require('../src/utils/errorContract');
const errorHandler = require('../src/middleware/errorHandler');

function responseRecorder() {
  return {
    code: null,
    body: null,
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('the public contract has a stable version and retry status table', () => {
  assert.equal(contract.ERROR_VERSION, 'v1');
  for (const status of [408, 429, 500, 502, 503, 504]) {
    assert.equal(contract.isRetryableStatus(status), true);
  }
  for (const status of [200, 201, 400, 401, 403, 404, 409, 422]) {
    assert.equal(contract.isRetryableStatus(status), false);
  }
});

test('ApiError exposes retryability for client backoff decisions', () => {
  assert.equal(ApiError.badRequest('bad').retryable, false);
  assert.equal(ApiError.serviceUnavailable('busy').retryable, true);
  assert.equal(new ApiError(409, 'conflict', undefined, 'CONFLICT', { retryable: true }).retryable, true);
});

test('validation details are normalized into bounded field messages', () => {
  const details = contract.sanitizeDetails([
    'quantity is required',
    'vintage must be an integer',
    { unexpected: true },
  ]);
  assert.deepEqual(details, {
    fields: ['quantity is required', 'vintage must be an integer'],
  });
});

test('object details retain safe primitives and redact secret-like keys', () => {
  const details = contract.sanitizeDetails({
    field: 'quantity',
    min: 1,
    allowed: true,
    nullable: null,
    providerToken: 'do-not-return',
    nested: { raw: 'not exposed' },
  });
  assert.deepEqual(details, {
    field: 'quantity',
    min: 1,
    allowed: true,
    nullable: null,
    providerToken: '[REDACTED]',
    nested: '[REDACTED]',
  });
});

test('details are bounded to a predictable number of keys and length', () => {
  const input = {};
  for (let i = 0; i < 40; i += 1) input[`field_${i}`] = 'x'.repeat(400);
  const output = contract.sanitizeDetails(input);
  assert.equal(Object.keys(output).length, 25);
  assert.equal(output.field_0.length, 256);
});

test('provider errors normalize transport failures without leaking messages', () => {
  const cases = [
    { code: 'ETIMEDOUT', expected: 'PROVIDER_ETIMEDOUT', status: 503 },
    { code: 'ECONNRESET', expected: 'PROVIDER_ECONNRESET', status: 503 },
    { code: 'ECONNREFUSED', expected: 'PROVIDER_ECONNREFUSED', status: 503 },
    { code: 'UNAVAILABLE', expected: 'PROVIDER_UNAVAILABLE', status: 503 },
    { code: 'RATE_LIMITED', expected: 'PROVIDER_RATE_LIMITED', status: 429 },
  ];
  for (const item of cases) {
    const normalized = contract.normalizeProviderError({
      code: item.code,
      message: 'private provider response with credentials=secret',
    });
    assert.equal(normalized.code, item.expected);
    assert.equal(normalized.statusCode, item.status);
    assert.equal(normalized.retryable, true);
    assert.ok(!normalized.message.includes('credentials'));
  }
});

test('numeric provider status codes get a stable namespaced code', () => {
  const normalized = contract.normalizeProviderError({ statusCode: 502 });
  assert.equal(normalized.code, 'PROVIDER_502');
  assert.equal(normalized.statusCode, 503);
});

test('ApiError.fromProvider preserves only safe provider metadata', () => {
  const error = ApiError.fromProvider({ code: 'ETIMEDOUT', message: 'authorization secret' });
  assert.equal(error.statusCode, 503);
  assert.equal(error.code, 'PROVIDER_ETIMEDOUT');
  assert.equal(error.message.includes('authorization'), false);
  assert.equal(error.retryable, true);
});

test('toPayload adds correlation and hides unexpected internal failures', () => {
  const payload = contract.toPayload(new Error('database password=secret'), 'req-123');
  assert.deepEqual(payload, {
    version: 'v1',
    code: 'INTERNAL_ERROR',
    message: 'Internal Server Error',
    status: 500,
    retryable: true,
    correlationId: 'req-123',
    details: null,
  });
});

test('toPayload retains operational client errors and machine-readable details', () => {
  const error = ApiError.badRequest('Validation failed', ['quantity is required']);
  const payload = contract.toPayload(error, 'req-456');
  assert.equal(payload.version, 'v1');
  assert.equal(payload.code, 'BAD_REQUEST');
  assert.equal(payload.status, 400);
  assert.equal(payload.retryable, false);
  assert.deepEqual(payload.details, { fields: ['quantity is required'] });
  assert.equal(payload.correlationId, 'req-456');
});

test('missing correlation identifiers are represented as null, not undefined', () => {
  const payload = contract.toPayload(ApiError.notFound('missing'));
  assert.equal(payload.correlationId, null);
});

test('error handler returns the versioned envelope and request correlation ID', () => {
  const res = responseRecorder();
  errorHandler(ApiError.conflict('already settled'), { id: 'req-789', method: 'POST', originalUrl: '/api/buy' }, res, () => {});
  assert.equal(res.code, 409);
  assert.equal(res.body.error.version, 'v1');
  assert.equal(res.body.error.code, 'CONFLICT');
  assert.equal(res.body.error.correlationId, 'req-789');
  assert.equal(res.body.error.retryable, false);
});

test('error handler maps a provider failure to a retryable public response', () => {
  const res = responseRecorder();
  const error = ApiError.fromProvider({ code: 'RATE_LIMITED', message: 'upstream secret' });
  errorHandler(error, { id: 'req-provider', method: 'POST', originalUrl: '/api/retire' }, res, () => {});
  assert.equal(res.code, 429);
  assert.equal(res.body.error.code, 'PROVIDER_RATE_LIMITED');
  assert.equal(res.body.error.retryable, true);
  assert.equal(res.body.error.message.includes('secret'), false);
});

test('error handler keeps payload-too-large status while using safe messaging', () => {
  const res = responseRecorder();
  errorHandler({ status: 413, message: 'request entity too large' }, { id: 'req-large', method: 'POST', originalUrl: '/api/batches' }, res, () => {});
  assert.equal(res.code, 413);
  assert.equal(res.body.error.version, 'v1');
  assert.equal(res.body.error.status, 413);
  assert.equal(res.body.error.code, 'ERROR');
});

test('long correlation values are bounded before returning to clients', () => {
  const payload = contract.toPayload(ApiError.badRequest('bad'), 'x'.repeat(400));
  assert.equal(payload.correlationId.length, 256);
});

test('unknown provider codes still produce a stable retryable contract', () => {
  const normalized = contract.normalizeProviderError({ code: 'SOMETHING_NEW' });
  assert.equal(normalized.code, 'PROVIDER_UNAVAILABLE');
  assert.equal(normalized.statusCode, 503);
  assert.equal(normalized.retryable, true);
});
