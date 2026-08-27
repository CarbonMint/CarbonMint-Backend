'use strict';

const express = require('express');
const retirementController = require('../controllers/retirementController');
const validate = require('../middleware/validate');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');
const { MAX_BATCH_QUANTITY } = require('../config/constants');
const { ROLES, TRADE_ROLES } = require('../config/roles');

const router = express.Router();

const retireSchema = {
  batchId: { type: 'string', required: true },
  user: { type: 'string', required: true },
  quantity: { type: 'integer', required: true, min: 1, max: MAX_BATCH_QUANTITY },
  beneficiary: { type: 'string', required: false },
  reason: { type: 'string', required: false },
  retirementId: { type: 'string', required: false },
};

const correctionSchema = {
  beneficiary: { type: 'string', required: false },
  reason: { type: 'string', required: false },
  correctionReason: { type: 'string', required: true },
};

// POST /api/retire – retire (burn) credits; any authenticated user (buyer, issuer, admin)
router.post(
  '/retire',
  authenticate,
  requireRole(...TRADE_ROLES),
  validate(retireSchema),
  asyncHandler(retirementController.retire)
);

// GET /api/certificates – public read (anyone can verify certificates)
router.get('/certificates', asyncHandler(retirementController.listCertificates));

// GET /api/certificates/:id – public read
router.get('/certificates/:id', asyncHandler(retirementController.getCertificate));

// Corrections never overwrite original facts; they append an audited event.
router.patch(
  '/certificates/:id',
  authenticate,
  requireRole(ROLES.ADMIN),
  validate(correctionSchema),
  asyncHandler(retirementController.correctCertificate)
);

module.exports = router;
