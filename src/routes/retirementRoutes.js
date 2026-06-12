'use strict';

const express = require('express');
const retirementController = require('../controllers/retirementController');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

const retireSchema = {
  batchId: { type: 'string', required: true },
  user: { type: 'string', required: true },
  quantity: { type: 'integer', required: true, min: 1 },
  beneficiary: { type: 'string', required: false },
  reason: { type: 'string', required: false },
};

// POST /api/retire
router.post('/retire', validate(retireSchema), asyncHandler(retirementController.retire));

// GET /api/certificates
router.get('/certificates', asyncHandler(retirementController.listCertificates));

// GET /api/certificates/:id
router.get('/certificates/:id', asyncHandler(retirementController.getCertificate));

module.exports = router;
