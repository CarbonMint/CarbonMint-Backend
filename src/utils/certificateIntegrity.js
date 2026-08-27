'use strict';

const crypto = require('node:crypto');

/**
 * Version of the canonical certificate payload. Bumping this value is a
 * deliberate compatibility event because it changes every content hash.
 */
const CERTIFICATE_SCHEMA_VERSION = 1;

// Keep this list explicit. Object insertion order is not a suitable integrity
// contract when certificates can be serialized by different runtimes.
const IMMUTABLE_FIELDS = [
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
];

function canonicalJson(value) {
  return JSON.stringify(value);
}

/** Return the exact signed payload for a certificate's immutable facts. */
function canonicalCertificatePayload(certificate) {
  const payload = { schemaVersion: certificate.schemaVersion };
  for (const field of IMMUTABLE_FIELDS) {
    payload[field] = certificate[field];
  }
  return payload;
}

function digest(value) {
  return `sha256:${crypto.createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

/** Calculate the certificate hash from immutable, canonicalized fields. */
function certificateContentHash(certificate) {
  return digest(canonicalCertificatePayload(certificate));
}

/** Create a deterministic key for retries of one logical retirement. */
function retirementRequestHash({ batchId, user, quantity, beneficiary, reason, retirementId }) {
  return digest({
    batchId,
    user,
    quantity,
    beneficiary,
    reason,
    retirementId: retirementId || null,
  });
}

/**
 * Calculate a chained hash for one append-only correction event. The previous
 * hash makes deletion, reordering, and alteration of correction history
 * detectable during retrieval.
 */
function correctionContentHash(correction) {
  return digest({
    certificateId: correction.certificateId,
    correctionId: correction.correctionId,
    actor: correction.actor,
    changes: {
      beneficiary: correction.changes.beneficiary,
      reason: correction.changes.reason,
    },
    correctionReason: correction.correctionReason,
    correctedAt: correction.correctedAt,
    previousHash: correction.previousHash,
  });
}

/**
 * Verify both the immutable certificate payload and its correction chain.
 * Returns false for missing metadata as well as any altered field.
 */
function verifyCertificateIntegrity(certificate) {
  if (!certificate || certificate.schemaVersion !== CERTIFICATE_SCHEMA_VERSION) {
    return false;
  }
  if (certificate.contentHash !== certificateContentHash(certificate)) {
    return false;
  }

  let previousHash = certificate.contentHash;
  if (!Array.isArray(certificate.corrections)) return false;
  for (const correction of certificate.corrections) {
    if (correction.previousHash !== previousHash) return false;
    if (correction.hash !== correctionContentHash(correction)) return false;
    previousHash = correction.hash;
  }
  return true;
}

/** Apply audited corrections to produce the current verified presentation. */
function currentCertificateValues(certificate) {
  const current = {
    beneficiary: certificate.beneficiary,
    reason: certificate.reason,
  };
  for (const correction of certificate.corrections) {
    Object.assign(current, correction.changes);
  }
  return current;
}

module.exports = {
  CERTIFICATE_SCHEMA_VERSION,
  canonicalCertificatePayload,
  certificateContentHash,
  retirementRequestHash,
  correctionContentHash,
  verifyCertificateIntegrity,
  currentCertificateValues,
};
