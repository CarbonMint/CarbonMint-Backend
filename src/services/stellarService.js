'use strict';

const config = require('../config');
const { shortId } = require('../utils/ids');
const logger = require('../utils/logger');

/**
 * Mock Stellar / Soroban service.
 *
 * In a production deployment these functions would submit transactions to a
 * Soroban smart contract via the Stellar SDK. Here we simulate the network by
 * returning deterministic, well-formed mock transaction hashes and ledger
 * metadata so the rest of the application can be built and tested offline.
 */
function mockTxHash() {
  return `stellar_tx_${shortId()}${shortId()}`;
}

function mockLedger() {
  return Math.floor(1_000_000 + Math.random() * 9_000_000);
}

function baseResult(operation, extra = {}) {
  return {
    success: true,
    operation,
    network: config.stellar.network,
    contractId: config.stellar.contractId,
    txHash: mockTxHash(),
    ledger: mockLedger(),
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

/** Simulate minting a tokenized carbon-credit batch on-chain. */
function mintCredits(batchId, quantity) {
  logger.debug('stellarService.mintCredits', { batchId, quantity });
  return baseResult('mint', { batchId, quantity });
}

/** Simulate transferring credits from a seller to a buyer. */
function transferCredits(batchId, from, to, quantity) {
  logger.debug('stellarService.transferCredits', { batchId, from, to, quantity });
  return baseResult('transfer', { batchId, from, to, quantity });
}

/** Simulate burning (retiring) credits permanently. */
function burnCredits(batchId, owner, quantity) {
  logger.debug('stellarService.burnCredits', { batchId, owner, quantity });
  return baseResult('burn', { batchId, owner, quantity });
}

module.exports = { mintCredits, transferCredits, burnCredits, mockTxHash };
