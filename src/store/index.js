'use strict';

/**
 * In-memory data store for CarbonMint.
 *
 * This is a deliberately simple object-graph store. There is no database;
 * everything lives in process memory and is seeded on boot. Collections are
 * keyed by id for O(1) lookups while still being easy to iterate.
 */
const store = {
  projects: new Map(),
  batches: new Map(),
  certificates: new Map(),
  // holdings: user => Map(batchId => quantity)
  holdings: new Map(),
};

function reset() {
  store.projects.clear();
  store.batches.clear();
  store.certificates.clear();
  store.holdings.clear();
}

module.exports = { store, reset };
