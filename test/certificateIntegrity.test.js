'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  CERTIFICATE_SCHEMA_VERSION,
  certificateContentHash,
  correctionContentHash,
  currentCertificateValues,
  verifyCertificateIntegrity,
} = require('../src/utils/certificateIntegrity');

function certificate(overrides = {}) {
  const value = {
    schemaVersion: CERTIFICATE_SCHEMA_VERSION,
    id: 'cert_fixture',
    batchId: 'batch_fixture',
    projectId: 'project_fixture',
    projectName: 'Fixture Forest',
    vintage: 2024,
    quantity: 10,
    retiredBy: 'buyer_fixture',
    beneficiary: 'buyer_fixture',
    reason: 'Fixture retirement',
    txHash: 'stellar_tx_fixture',
    retiredAt: '2026-08-27T00:00:00.000Z',
    corrections: [],
    ...overrides,
  };
  value.contentHash = certificateContentHash(value);
  return value;
}

function correction(base, changes, overrides = {}) {
  const event = {
    certificateId: base.id,
    correctionId: 'corr_fixture',
    actor: 'admin_fixture',
    changes,
    correctionReason: 'Corrected registry spelling',
    correctedAt: '2026-08-27T01:00:00.000Z',
    previousHash: base.contentHash,
    ...overrides,
  };
  event.hash = correctionContentHash(event);
  return event;
}

test('canonical certificate hash is stable for equivalent field order', () => {
  const first = certificate();
  const reordered = certificate({
    reason: 'Fixture retirement',
    beneficiary: 'buyer_fixture',
  });

  assert.equal(first.contentHash, reordered.contentHash);
  assert.match(first.contentHash, /^sha256:[0-9a-f]{64}$/);
  assert.deepEqual(verifyCertificateIntegrity(first), true);
});

test('changing any signed certificate fact fails verification', () => {
  const stored = certificate();
  for (const field of [
    'id',
    'batchId',
    'projectId',
    'projectName',
    'vintage',
    'quantity',
    'retiredBy',
    'beneficiary',
    'reason',
    'txHash',
    'retiredAt',
  ]) {
    const tampered = { ...stored, [field]: `${stored[field]}_tampered` };
    assert.equal(verifyCertificateIntegrity(tampered), false, field);
  }
});

test('schema changes fail closed instead of being interpreted as old hashes', () => {
  const stored = certificate();
  assert.equal(verifyCertificateIntegrity({ ...stored, schemaVersion: 99 }), false);
  assert.equal(verifyCertificateIntegrity({ ...stored, schemaVersion: undefined }), false);
  assert.equal(verifyCertificateIntegrity({ ...stored, corrections: undefined }), false);
});

test('a correction is valid only when chained to the certificate hash', () => {
  const stored = certificate();
  const event = correction(stored, { reason: 'Corrected registry spelling' });
  const corrected = { ...stored, corrections: [event] };

  assert.equal(verifyCertificateIntegrity(corrected), true);
  assert.deepEqual(currentCertificateValues(corrected), {
    beneficiary: 'buyer_fixture',
    reason: 'Corrected registry spelling',
  });
});

test('correction deletion, reordering, and field edits are detectable', () => {
  const stored = certificate();
  const first = correction(stored, { reason: 'First correction' });
  const second = correction(
    { ...stored, corrections: [first] },
    { beneficiary: 'beneficiary_fixture' },
    { correctionId: 'corr_second', previousHash: first.hash }
  );
  const corrected = { ...stored, corrections: [first, second] };

  assert.equal(verifyCertificateIntegrity(corrected), true);
  assert.equal(verifyCertificateIntegrity({ ...stored, corrections: [second] }), false);
  assert.equal(verifyCertificateIntegrity({ ...stored, corrections: [second, first] }), false);
  assert.equal(
    verifyCertificateIntegrity({
      ...corrected,
      corrections: [{ ...first, correctionReason: 'tampered' }, second],
    }),
    false
  );
});

test('current values apply corrections in append order without mutating originals', () => {
  const stored = certificate();
  const first = correction(stored, { beneficiary: 'company_fixture' });
  const second = correction(
    { ...stored, corrections: [first] },
    { reason: 'Updated public claim wording' },
    { correctionId: 'corr_second', previousHash: first.hash }
  );
  const corrected = { ...stored, corrections: [first, second] };

  assert.deepEqual(currentCertificateValues(corrected), {
    beneficiary: 'company_fixture',
    reason: 'Updated public claim wording',
  });
  assert.equal(stored.beneficiary, 'buyer_fixture');
  assert.equal(stored.reason, 'Fixture retirement');
});
