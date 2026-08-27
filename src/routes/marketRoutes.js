'use strict';

const express = require('express');
const marketController = require('../controllers/marketController');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');
const { MAX_BATCH_QUANTITY } = require('../config/constants');
const { TRADE_ROLES } = require('../config/roles');

const router = express.Router();

const buySchema = {
  batchId: { type: 'string', required: true },
  buyer: { type: 'string', required: true },
  quantity: { type: 'integer', required: true, min: 1, max: MAX_BATCH_QUANTITY },
};
buySchema.idempotencyKey = { type: 'string', minLength: 8, maxLength: 128 };

// GET /api/listings – public read
router.get('/listings', asyncHandler(marketController.listListings));

// GET /api/market/stats – public read
router.get('/market/stats', asyncHandler(marketController.getMarketStats));

// POST /api/buy – buy credits; any authenticated user (buyer, issuer, admin)
router.post(
  '/buy',
  authenticate,
  requireRole(...TRADE_ROLES),
  validate(buySchema),
  asyncHandler(marketController.buy)
);

module.exports = router;
