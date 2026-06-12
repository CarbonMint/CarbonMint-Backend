'use strict';

const express = require('express');
const batchController = require('../controllers/batchController');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { MAX_BATCH_QUANTITY, MAX_PRICE_PER_CREDIT } = require('../config/constants');

const router = express.Router();

const mintSchema = {
  projectId: { type: 'string', required: true },
  quantity: { type: 'integer', required: true, min: 1, max: MAX_BATCH_QUANTITY },
  vintage: { type: 'integer', required: true, min: 2000, max: 2100 },
  owner: { type: 'string', required: true },
  pricePerCredit: { type: 'number', required: false, min: 0, max: MAX_PRICE_PER_CREDIT },
};

// GET /api/batches
router.get('/', asyncHandler(batchController.listBatches));

// POST /api/batches
router.post('/', validate(mintSchema), asyncHandler(batchController.createBatch));

// GET /api/batches/:id
router.get('/:id', asyncHandler(batchController.getBatch));

module.exports = router;
