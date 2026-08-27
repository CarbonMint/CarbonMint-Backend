'use strict';

const express = require('express');
const auditController = require('../controllers/auditController');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.get('/', authenticate, requireRole('admin'), asyncHandler(auditController.listAuditEvents));

module.exports = router;
