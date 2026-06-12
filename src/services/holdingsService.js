'use strict';

const { store } = require('../store');

/**
 * Holdings service. Tracks how many credits each user holds per batch.
 * Holdings are stored as a nested map: user => (batchId => quantity).
 */
function getUserMap(user) {
  if (!store.holdings.has(user)) {
    store.holdings.set(user, new Map());
  }
  return store.holdings.get(user);
}

function getBalance(user, batchId) {
  const userMap = store.holdings.get(user);
  if (!userMap) return 0;
  return userMap.get(batchId) || 0;
}

function credit(user, batchId, quantity) {
  const userMap = getUserMap(user);
  userMap.set(batchId, (userMap.get(batchId) || 0) + quantity);
}

function debit(user, batchId, quantity) {
  const userMap = getUserMap(user);
  const current = userMap.get(batchId) || 0;
  const next = current - quantity;
  if (next <= 0) {
    userMap.delete(batchId);
  } else {
    userMap.set(batchId, next);
  }
}

function listHoldings(user) {
  const userMap = store.holdings.get(user);
  if (!userMap) return [];
  return Array.from(userMap.entries()).map(([batchId, quantity]) => ({
    batchId,
    quantity,
  }));
}

module.exports = { getBalance, credit, debit, listHoldings };
