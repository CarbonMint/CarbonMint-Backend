'use strict';

const { store } = require('../store');
const { MIN_VINTAGE, MAX_VINTAGE } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const { prefixedId } = require('../utils/ids');
const projectService = require('./projectService');
const stellarService = require('./stellarService');
const holdingsService = require('./holdingsService');

/**
 * Batch service. A batch represents a tokenized quantity of carbon credits
 * minted against a verified project. Each credit equals one tonne of CO2e.
 */
function listBatches(filter = {}) {
  let batches = Array.from(store.batches.values());
  if (filter.projectId) {
    batches = batches.filter((b) => b.projectId === filter.projectId);
  }
  if (filter.vintage != null) {
    batches = batches.filter((b) => b.vintage === filter.vintage);
  }
  if (filter.status) {
    batches = batches.filter((b) => b.status === filter.status);
  }
  return batches;
}

function getBatch(id) {
  const batch = store.batches.get(id);
  if (!batch) {
    throw ApiError.notFound(`Batch ${id} not found`);
  }
  return batch;
}

/**
 * Mint a new credit batch. Validates the backing project, simulates the
 * on-chain mint, records the batch and credits the issuer's holdings.
 */
function mintBatch({ projectId, quantity, vintage, owner, pricePerCredit }) {
  const project = projectService.getProject(projectId);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw ApiError.badRequest('quantity must be a positive integer');
  }
  if (pricePerCredit != null && pricePerCredit < 0) {
    throw ApiError.badRequest('pricePerCredit cannot be negative');
  }
  if (
    !Number.isInteger(vintage) ||
    vintage < MIN_VINTAGE ||
    vintage > MAX_VINTAGE
  ) {
    throw ApiError.badRequest(
      `vintage must be an integer between ${MIN_VINTAGE} and ${MAX_VINTAGE}`
    );
  }

  const id = prefixedId('batch');
  const onChain = stellarService.mintCredits(id, quantity);

  const batch = {
    id,
    projectId,
    projectName: project.name,
    quantity,
    available: quantity,
    retired: 0,
    vintage,
    owner,
    pricePerCredit: pricePerCredit ?? null,
    forSale: pricePerCredit != null,
    status: 'active',
    txHash: onChain.txHash,
    createdAt: new Date().toISOString(),
  };

  store.batches.set(id, batch);
  holdingsService.credit(owner, id, quantity);

  return batch;
}

module.exports = { listBatches, getBatch, mintBatch };
