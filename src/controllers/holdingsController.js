'use strict';

const ApiError = require('../utils/ApiError');
const holdingsService = require('../services/holdingsService');
const batchService = require('../services/batchService');

/** GET /api/holdings?user= */
function getHoldings(req, res) {
  const user = req.query.user;
  if (!user) {
    throw ApiError.badRequest('Query parameter "user" is required');
  }

  const raw = holdingsService.listHoldings(user);
  const holdings = raw.map((h) => {
    const batch = batchService.getBatch(h.batchId);
    return {
      batchId: h.batchId,
      projectId: batch.projectId,
      projectName: batch.projectName,
      vintage: batch.vintage,
      quantity: h.quantity,
    };
  });

  const totalCredits = holdings.reduce((sum, h) => sum + h.quantity, 0);
  res.json({ user, totalCredits, holdings });
}

/** GET /api/holdings/summary?user= */
function getHoldingsSummary(req, res) {
  const user = req.query.user;
  if (!user) {
    throw ApiError.badRequest('Query parameter "user" is required');
  }

  const raw = holdingsService.listHoldings(user);
  const byProject = new Map();
  let totalCredits = 0;

  for (const h of raw) {
    const batch = batchService.getBatch(h.batchId);
    totalCredits += h.quantity;
    const entry = byProject.get(batch.projectId) || {
      projectId: batch.projectId,
      projectName: batch.projectName,
      credits: 0,
      batchCount: 0,
    };
    entry.credits += h.quantity;
    entry.batchCount += 1;
    byProject.set(batch.projectId, entry);
  }

  res.json({
    user,
    totalCredits,
    batchCount: raw.length,
    projectCount: byProject.size,
    projects: Array.from(byProject.values()),
  });
}

module.exports = { getHoldings, getHoldingsSummary };
