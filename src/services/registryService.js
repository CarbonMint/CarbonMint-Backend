'use strict';

const { TONNES_CO2E_PER_CREDIT } = require('../config/constants');
const { aggregateSupply, retirementRate } = require('../utils/supply');
const { round2 } = require('../utils/money');
const batchService = require('./batchService');
const retirementService = require('./retirementService');

/**
 * Registry service. Provides aggregate analytics across the marketplace:
 * total credits minted, total retired and the active (tradeable) supply.
 */
function getRegistryStats() {
  const batches = batchService.listBatches();

  const {
    minted: totalMinted,
    retired: totalRetired,
    available: activeSupply,
  } = aggregateSupply(batches);

  const certificates = retirementService.listCertificates();

  return {
    totalMinted,
    totalRetired,
    activeSupply,
    tonnesCo2eRetired: totalRetired * TONNES_CO2E_PER_CREDIT,
    retirementRate: round2(retirementRate(totalMinted, totalRetired) * 100),
    batchCount: batches.length,
    certificateCount: certificates.length,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { getRegistryStats };
