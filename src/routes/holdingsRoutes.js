'use strict';

const express = require('express');
const holdingsController = require('../controllers/holdingsController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// GET /api/holdings?user=
router.get('/', asyncHandler(holdingsController.getHoldings));

module.exports = router;
