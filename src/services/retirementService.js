'use strict';

const { store } = require('../store');
const { BATCH_STATUS } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const { prefixedId } = require('../utils/ids');
const batchService = require('./batchService');
const stellarService = require('./stellarService');
const holdingsService = require('./holdingsService');

/**
 * Retirement service. Retiring credits permanently burns them so they can no
 * longer be traded, and issues a retirement certificate as proof of the
 * climate claim.
 */
function listCertificates() {
  return Array.from(store.certificates.values());
}

function getCertificate(id) {
  const certificate = store.certificates.get(id);
  if (!certificate) {
    throw ApiError.notFound(`Certificate ${id} not found`);
  }
  return certificate;
}

/**
 * Retire credits held by a user. Validates the user actually holds enough,
 * simulates the on-chain burn, updates supply accounting and mints a
 * certificate.
 */
function retire({ batchId, user, quantity, beneficiary, reason }) {
  const batch = batchService.getBatch(batchId);
  const balance = holdingsService.getBalance(user, batchId);

  if (quantity > balance) {
    throw ApiError.badRequest(
      `User holds ${balance} credits in batch ${batchId}, cannot retire ${quantity}`
    );
  }

  const onChain = stellarService.burnCredits(batchId, user, quantity);

  holdingsService.debit(user, batchId, quantity);
  batch.available = Math.max(0, batch.available - quantity);
  batch.retired += quantity;
  if (batch.available === 0) {
    batch.forSale = false;
    batch.status =
      batch.retired === batch.quantity ? BATCH_STATUS.RETIRED : BATCH_STATUS.SOLD_OUT;
  }

  const id = prefixedId('cert');
  const certificate = {
    id,
    batchId,
    projectId: batch.projectId,
    projectName: batch.projectName,
    vintage: batch.vintage,
    quantity,
    retiredBy: user,
    beneficiary: beneficiary || user,
    reason: reason || 'Voluntary carbon offset',
    txHash: onChain.txHash,
    retiredAt: new Date().toISOString(),
  };

  store.certificates.set(id, certificate);
  return certificate;
}

module.exports = { listCertificates, getCertificate, retire };
