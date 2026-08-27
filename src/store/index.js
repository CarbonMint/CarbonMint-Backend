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
  // users: userId => { id, role }  (used by RBAC authenticate middleware)
  users: new Map(),
  reservations: new Map(),
  auditEvents: new Map(),
};

function reset() {
  store.projects.clear();
  store.batches.clear();
  store.certificates.clear();
  store.holdings.clear();
  store.users.clear();
  store.reservations.clear();
  store.auditEvents.clear();
}

/** Snapshot of collection sizes, handy for health checks and diagnostics. */
function counts() {
  return {
    projects: store.projects.size,
    batches: store.batches.size,
    certificates: store.certificates.size,
    accounts: store.holdings.size,
    auditEvents: store.auditEvents.size,
  };
}

/**
 * Queue-depth metric: returns the count of batches broken down by status.
 * The "active" count represents batches currently in the pipeline
 * (minted and available for trading or retirement).
 */
function queueDepth() {
  const byStatus = {};
  for (const batch of store.batches.values()) {
    byStatus[batch.status] = (byStatus[batch.status] || 0) + 1;
  }
  return byStatus;
}

module.exports = { store, reset, counts, queueDepth };
