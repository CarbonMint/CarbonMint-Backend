'use strict';

const express = require('express');
const healthController = require('../controllers/healthController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// GET /api/health
router.get('/', asyncHandler(healthController.getHealth));

// GET /api/health/live
router.get('/live', asyncHandler(healthController.getLiveness));

// GET /api/health/ready
router.get('/ready', asyncHandler(healthController.getReadiness));

module.exports = router;
