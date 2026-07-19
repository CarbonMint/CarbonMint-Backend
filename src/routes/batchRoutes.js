'use strict';

const express = require('express');
const batchController = require('../controllers/batchController');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');
const {
  MAX_BATCH_QUANTITY,
  MAX_PRICE_PER_CREDIT,
  MIN_VINTAGE,
  MAX_VINTAGE,
} = require('../config/constants');
const { MINT_ROLES } = require('../config/roles');

const router = express.Router();

const mintSchema = {
  projectId: { type: 'string', required: true },
  quantity: { type: 'integer', required: true, min: 1, max: MAX_BATCH_QUANTITY },
  vintage: { type: 'integer', required: true, min: MIN_VINTAGE, max: MAX_VINTAGE },
  owner: { type: 'string', required: true },
  pricePerCredit: { type: 'number', required: false, min: 0, max: MAX_PRICE_PER_CREDIT },
};

// GET /api/batches – public read
router.get('/', asyncHandler(batchController.listBatches));

// POST /api/batches – mint a batch; restricted to issuers and admins
router.post(
  '/',
  authenticate,
  requireRole(...MINT_ROLES),
  validate(mintSchema),
  asyncHandler(batchController.createBatch)
);

// GET /api/batches/:id – public read
router.get('/:id', asyncHandler(batchController.getBatch));

module.exports = router;
