'use strict';

const { store } = require('../store');
const { BATCH_STATUS } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const { prefixedId } = require('../utils/ids');
const batchService = require('./batchService');
const stellarService = require('./stellarService');
const holdingsService = require('./holdingsService');
const {
  CERTIFICATE_SCHEMA_VERSION,
  certificateContentHash,
  correctionContentHash,
  currentCertificateValues,
  retirementRequestHash,
  verifyCertificateIntegrity,
} = require('../utils/certificateIntegrity');

const CORRECTION_FIELDS = new Set(['beneficiary', 'reason']);

function assertCertificateIntegrity(certificate) {
  if (!verifyCertificateIntegrity(certificate)) {
    throw ApiError.conflict(
      `Certificate ${certificate.id} failed integrity verification`,
      'CERTIFICATE_INTEGRITY_FAILURE'
    );
  }
}

function presentCertificate(certificate, viewer) {
  assertCertificateIntegrity(certificate);
  if (viewer && viewer !== certificate.retiredBy) {
    throw ApiError.forbidden('Certificate ownership verification failed');
  }

  const current = currentCertificateValues(certificate);
  return {
    ...certificate,
    corrections: certificate.corrections.map((correction) => ({
      ...correction,
      changes: { ...correction.changes },
    })),
    current,
  };
}

function nextCertificateId() {
  let id;
  do {
    id = prefixedId('cert');
  } while (store.certificates.has(id));
  return id;
}

function nextCorrectionId(certificate) {
  let id;
  do {
    id = prefixedId('corr');
  } while (certificate.corrections.some((correction) => correction.correctionId === id));
  return id;
}
const auditService = require('./auditService');

/**
 * Retirement service. Retiring credits permanently burns them so they can no
 * longer be traded, and issues a retirement certificate as proof of the
 * climate claim.
 */
function listCertificates(filter = {}) {
  let certificates = Array.from(store.certificates.values());
  if (filter.user) {
    certificates = certificates.filter((c) => c.retiredBy === filter.user);
  }
  if (filter.projectId) {
    certificates = certificates.filter((c) => c.projectId === filter.projectId);
  }
  return certificates.map((certificate) => presentCertificate(certificate, filter.user));
}

function getCertificate(id, { user } = {}) {
  const certificate = store.certificates.get(id);
  if (!certificate) {
    throw ApiError.notFound(`Certificate ${id} not found`);
  }
  return presentCertificate(certificate, user);
}

/**
 * Retire credits held by a user. Validates the user actually holds enough,
 * simulates the on-chain burn, updates supply accounting and mints a
 * certificate.
 */
function retire({ batchId, user, quantity, beneficiary, reason, retirementId, actor, correlationId }) {
  const effectiveBeneficiary = beneficiary || user;
  const effectiveReason = reason || 'Voluntary carbon offset';
  const requestDigest = retirementRequestHash({
    batchId,
    user,
    quantity,
    beneficiary: effectiveBeneficiary,
    reason: effectiveReason,
    retirementId,
  });
  const retirementKey = retirementId ? `id:${retirementId}` : `request:${requestDigest}`;

  // A client retry returns the original certificate without burning twice.
  // The digest also prevents reusing an idempotency key for different facts.
  const existingId = store.retirementKeys.get(retirementKey);
  if (existingId) {
    const existing = store.certificates.get(existingId);
    if (!existing || existing.requestDigest !== requestDigest) {
      throw ApiError.conflict('Retirement idempotency record is inconsistent');
    }
    return presentCertificate(existing, user);
  }

  const batch = batchService.getBatch(batchId);
  const balance = holdingsService.getBalance(user, batchId);

  if (quantity > balance) {
    throw ApiError.badRequest(
      `User holds ${balance} credits in batch ${batchId}, cannot retire ${quantity}`
    );
  }

  let onChain;
  try {
    onChain = stellarService.burnCredits(batchId, user, quantity);
  } catch (error) {
    throw ApiError.fromProvider(error);
  }

  holdingsService.debit(user, batchId, quantity);
  batch.available = Math.max(0, batch.available - quantity);
  batch.retired += quantity;
  if (batch.available === 0) {
    batch.forSale = false;
    batch.status =
      batch.retired === batch.quantity ? BATCH_STATUS.RETIRED : BATCH_STATUS.SOLD_OUT;
  }

  const id = nextCertificateId();
  const certificate = {
    schemaVersion: CERTIFICATE_SCHEMA_VERSION,
    id,
    batchId,
    projectId: batch.projectId,
    projectName: batch.projectName,
    vintage: batch.vintage,
    quantity,
    retiredBy: user,
    beneficiary: effectiveBeneficiary,
    reason: effectiveReason,
    txHash: onChain.txHash,
    retiredAt: new Date().toISOString(),
    requestDigest,
    corrections: [],
  };
  certificate.contentHash = certificateContentHash(certificate);

  store.certificates.set(id, certificate);
  store.retirementKeys.set(retirementKey, id);
  auditService.record({
    actor,
    action: 'credits.retire',
    target: batchId,
    correlationId,
    metadata: { certificateId: id, user, quantity, beneficiary, reason, txHash: onChain.txHash },
  });
  return presentCertificate(certificate, user);
}

/**
 * Append an audited correction without changing the original certificate
 * facts. Only whitelisted presentation fields may be corrected; each event is
 * chained to the preceding hash and is verified on every read.
 */
function correctCertificate({ id, actor, beneficiary, reason, correctionReason }) {
  const certificate = store.certificates.get(id);
  if (!certificate) {
    throw ApiError.notFound(`Certificate ${id} not found`);
  }
  assertCertificateIntegrity(certificate);

  const changes = {};
  if (beneficiary !== undefined) changes.beneficiary = beneficiary;
  if (reason !== undefined) changes.reason = reason;
  for (const field of Object.keys(changes)) {
    if (!CORRECTION_FIELDS.has(field)) {
      throw ApiError.badRequest(`Certificate field ${field} cannot be corrected`);
    }
  }
  if (Object.keys(changes).length === 0) {
    throw ApiError.badRequest('At least one correctable certificate field is required');
  }

  const current = currentCertificateValues(certificate);
  if (Object.entries(changes).every(([field, value]) => current[field] === value)) {
    throw ApiError.badRequest('Correction must change at least one certificate field');
  }

  const previousHash = certificate.corrections.length
    ? certificate.corrections[certificate.corrections.length - 1].hash
    : certificate.contentHash;
  const correction = {
    certificateId: certificate.id,
    correctionId: nextCorrectionId(certificate),
    actor,
    changes,
    correctionReason,
    correctedAt: new Date().toISOString(),
    previousHash,
  };
  if (typeof correctionReason !== 'string' || correctionReason.trim() === '') {
    throw ApiError.badRequest('correctionReason is required');
  }
  correction.hash = correctionContentHash(correction);
  certificate.corrections.push(correction);
  return presentCertificate(certificate);
}

module.exports = {
  listCertificates,
  getCertificate,
  retire,
  correctCertificate,
};
