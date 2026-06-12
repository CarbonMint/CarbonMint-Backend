'use strict';

const config = require('../config');
const { BATCH_STATUS } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const money = require('../utils/money');
const batchService = require('./batchService');
const stellarService = require('./stellarService');
const holdingsService = require('./holdingsService');

/**
 * Market service. Handles the marketplace surface: which batches are listed
 * for sale and the buy flow that transfers credits between users.
 */
function listListings(filter = {}) {
  return batchService
    .listBatches()
    .filter((b) => b.forSale && b.available > 0)
    .filter((b) => (filter.projectId ? b.projectId === filter.projectId : true))
    .map((b) => ({
      batchId: b.id,
      projectId: b.projectId,
      projectName: b.projectName,
      vintage: b.vintage,
      available: b.available,
      pricePerCredit: b.pricePerCredit,
      seller: b.owner,
    }));
}

/**
 * Execute a purchase. Moves credits from the batch owner to the buyer,
 * decrements availability and returns a settlement receipt.
 */
function buy({ batchId, buyer, quantity }) {
  const batch = batchService.getBatch(batchId);

  if (!batch.forSale) {
    throw ApiError.conflict(`Batch ${batchId} is not listed for sale`);
  }
  if (quantity > batch.available) {
    throw ApiError.badRequest(
      `Requested ${quantity} credits but only ${batch.available} available`
    );
  }
  if (buyer === batch.owner) {
    throw ApiError.badRequest('Buyer and seller cannot be the same user');
  }

  const seller = batch.owner;
  const subtotal = money.multiply(batch.pricePerCredit, quantity);
  const fee = money.applyBps(subtotal, config.marketplace.platformFeeBps);
  const total = money.round2(subtotal + fee);

  const onChain = stellarService.transferCredits(batchId, seller, buyer, quantity);

  batch.available -= quantity;
  holdingsService.debit(seller, batchId, quantity);
  holdingsService.credit(buyer, batchId, quantity);

  if (batch.available === 0) {
    batch.forSale = false;
    batch.status = BATCH_STATUS.SOLD_OUT;
  }

  return {
    batchId,
    seller,
    buyer,
    quantity,
    pricePerCredit: batch.pricePerCredit,
    subtotal,
    fee,
    total,
    currency: 'USDC',
    txHash: onChain.txHash,
    settledAt: new Date().toISOString(),
  };
}

module.exports = { listListings, buy };
