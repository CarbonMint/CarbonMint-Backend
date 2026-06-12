'use strict';

const express = require('express');
const marketController = require('../controllers/marketController');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { MAX_BATCH_QUANTITY } = require('../config/constants');

const router = express.Router();

const buySchema = {
  batchId: { type: 'string', required: true },
  buyer: { type: 'string', required: true },
  quantity: { type: 'integer', required: true, min: 1, max: MAX_BATCH_QUANTITY },
};

// GET /api/listings
router.get('/listings', asyncHandler(marketController.listListings));

// GET /api/market/stats
router.get('/market/stats', asyncHandler(marketController.getMarketStats));

// POST /api/buy
router.post('/buy', validate(buySchema), asyncHandler(marketController.buy));

module.exports = router;
