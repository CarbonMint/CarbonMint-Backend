'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { SEED_BATCHES, seed } = require('../src/store/seed');
const { reset, store } = require('../src/store');
const holdingsService = require('../src/services/holdingsService');
const retirementService = require('../src/services/retirementService');

const BATCH_ID = SEED_BATCHES[0].id;
const OWNER = SEED_BATCHES[0].owner;

function setup() {
  reset();
  seed();
}

function retire(overrides = {}) {
  return retirementService.retire({
    batchId: BATCH_ID,
    user: OWNER,
    quantity: 10,
    beneficiary: 'claimant_fixture',
    reason: 'Verified forest retirement',
    ...overrides,
  });
}

test.beforeEach(setup);

test('new certificates contain canonical integrity metadata', () => {
  const result = retire({ retirementId: 'retirement-001' });

  assert.equal(result.schemaVersion, 1);
  assert.match(result.contentHash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(result.corrections.length, 0);
  assert.equal(result.current.beneficiary, 'claimant_fixture');
  assert.equal(result.current.reason, 'Verified forest retirement');
  assert.equal(store.certificates.size, 1);
});

test('retrying a retirement with the same explicit id returns one certificate', () => {
  const first = retire({ retirementId: 'retirement-retry-001' });
  const balanceAfterFirst = holdingsService.getBalance(OWNER, BATCH_ID);
  const second = retire({ retirementId: 'retirement-retry-001' });

  assert.equal(second.id, first.id);
  assert.equal(second.contentHash, first.contentHash);
  assert.equal(store.certificates.size, 1);
  assert.equal(holdingsService.getBalance(OWNER, BATCH_ID), balanceAfterFirst);
});

test('retrying an identical retirement without an idempotency key is stable', () => {
  const first = retire();
  const second = retire();

  assert.equal(second.id, first.id);
  assert.equal(store.certificates.size, 1);
});

test('reusing an idempotency key for different facts is rejected', () => {
  retire({ retirementId: 'retirement-reused' });

  assert.throws(
    () => retire({ retirementId: 'retirement-reused', quantity: 11 }),
    (error) => error.code === 'CONFLICT' && /idempotency/.test(error.message)
  );
  assert.equal(store.certificates.size, 1);
});

test('unique certificate ids remain unique even when many retirements are created', () => {
  for (let index = 0; index < 20; index += 1) {
    retire({
      quantity: 1,
      retirementId: `retirement-many-${index}`,
      beneficiary: `beneficiary-${index}`,
    });
  }

  const ids = Array.from(store.certificates.keys());
  assert.equal(ids.length, 20);
  assert.equal(new Set(ids).size, ids.length);
});

test('retrieval verifies the certificate owner when a viewer is supplied', () => {
  const result = retire({ retirementId: 'retirement-owner-check' });

  assert.equal(retirementService.getCertificate(result.id, { user: OWNER }).id, result.id);
  assert.throws(
    () => retirementService.getCertificate(result.id, { user: 'another-user' }),
    (error) => error.statusCode === 403 && error.code === 'FORBIDDEN'
  );
  // Public verification remains possible when no viewer is supplied.
  assert.equal(retirementService.getCertificate(result.id).id, result.id);
});

test('retrieval rejects a certificate whose immutable facts were tampered with', () => {
  const result = retire({ retirementId: 'retirement-tamper' });
  store.certificates.get(result.id).quantity = 999;

  assert.throws(
    () => retirementService.getCertificate(result.id),
    (error) => error.code === 'CERTIFICATE_INTEGRITY_FAILURE'
  );
  assert.throws(
    () => retirementService.listCertificates(),
    (error) => error.code === 'CERTIFICATE_INTEGRITY_FAILURE'
  );
});

test('admin corrections append an event and preserve original certificate facts', () => {
  const result = retire({ retirementId: 'retirement-correction' });
  const corrected = retirementService.correctCertificate({
    id: result.id,
    actor: 'admin_platform',
    beneficiary: 'corrected-beneficiary',
    correctionReason: 'Registry beneficiary correction',
  });

  assert.equal(corrected.beneficiary, 'claimant_fixture');
  assert.equal(corrected.current.beneficiary, 'corrected-beneficiary');
  assert.equal(corrected.corrections.length, 1);
  assert.equal(corrected.corrections[0].actor, 'admin_platform');
  assert.equal(corrected.corrections[0].previousHash, result.contentHash);
  assert.equal(corrected.contentHash, result.contentHash);

  const fetched = retirementService.getCertificate(result.id);
  assert.equal(fetched.current.beneficiary, 'corrected-beneficiary');
  assert.equal(fetched.corrections.length, 1);
});

test('multiple corrections form a verifiable append-only chain', () => {
  const result = retire({ retirementId: 'retirement-chain' });
  const first = retirementService.correctCertificate({
    id: result.id,
    actor: 'admin_platform',
    reason: 'Corrected project wording',
    correctionReason: 'Registry clarification',
  });
  const second = retirementService.correctCertificate({
    id: result.id,
    actor: 'admin_platform',
    beneficiary: 'organization-beneficiary',
    correctionReason: 'Beneficiary legal-name correction',
  });

  assert.equal(first.corrections.length, 1);
  assert.equal(second.corrections.length, 2);
  assert.equal(second.corrections[1].previousHash, second.corrections[0].hash);
  assert.equal(second.current.reason, 'Corrected project wording');
  assert.equal(second.current.beneficiary, 'organization-beneficiary');
  assert.equal(retirementService.getCertificate(result.id).contentHash, result.contentHash);
});

test('corrections cannot be empty or repeat the current value', () => {
  const result = retire({ retirementId: 'retirement-invalid-correction' });

  assert.throws(
    () => retirementService.correctCertificate({
      id: result.id,
      actor: 'admin_platform',
      correctionReason: 'No fields supplied',
    }),
    (error) => error.code === 'BAD_REQUEST'
  );
  assert.throws(
    () => retirementService.correctCertificate({
      id: result.id,
      actor: 'admin_platform',
      reason: result.reason,
      correctionReason: 'Same value',
    }),
    (error) => error.code === 'BAD_REQUEST'
  );
  assert.equal(store.certificates.get(result.id).corrections.length, 0);
});

test('corrections require an audit reason and reject unknown certificates', () => {
  const result = retire({ retirementId: 'retirement-correction-validation' });

  assert.throws(
    () => retirementService.correctCertificate({
      id: result.id,
      actor: 'admin_platform',
      reason: 'Updated reason',
    }),
    (error) => error.code === 'BAD_REQUEST' && /correctionReason/.test(error.message)
  );
  assert.throws(
    () => retirementService.correctCertificate({
      id: 'cert_missing',
      actor: 'admin_platform',
      reason: 'Updated reason',
      correctionReason: 'Registry correction',
    }),
    (error) => error.code === 'NOT_FOUND'
  );
});

test('list filtering returns verified current presentations', () => {
  const first = retire({ retirementId: 'retirement-filter-1', quantity: 3 });
  retire({
    retirementId: 'retirement-filter-2',
    quantity: 4,
    beneficiary: OWNER,
    reason: 'Second claim',
  });
  retirementService.correctCertificate({
    id: first.id,
    actor: 'admin_platform',
    reason: 'Corrected first claim',
    correctionReason: 'Registry correction',
  });

  const filtered = retirementService.listCertificates({ user: OWNER });
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].current.reason, 'Corrected first claim');
  assert.equal(filtered[1].current.reason, 'Second claim');
});
