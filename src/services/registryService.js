'use strict';

const batchService = require('./batchService');
const retirementService = require('./retirementService');

/**
 * Registry service. Provides aggregate analytics across the marketplace:
 * total credits minted, total retired and the active (tradeable) supply.
 */
function getRegistryStats() {
  const batches = batchService.listBatches();

  let totalMinted = 0;
  let totalRetired = 0;
  let activeSupply = 0;

  for (const batch of batches) {
    totalMinted += batch.quantity;
    totalRetired += batch.retired;
    activeSupply += batch.available;
  }

  const certificates = retirementService.listCertificates();

  return {
    totalMinted,
    totalRetired,
    activeSupply,
    batchCount: batches.length,
    certificateCount: certificates.length,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { getRegistryStats };
