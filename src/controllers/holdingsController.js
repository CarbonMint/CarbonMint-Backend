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

module.exports = { getHoldings };
