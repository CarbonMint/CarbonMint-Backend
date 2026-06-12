'use strict';

const express = require('express');
const holdingsController = require('../controllers/holdingsController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// GET /api/holdings?user=
router.get('/', asyncHandler(holdingsController.getHoldings));

// GET /api/holdings/summary?user=
router.get('/summary', asyncHandler(holdingsController.getHoldingsSummary));

module.exports = router;
