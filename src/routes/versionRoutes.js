'use strict';

const express = require('express');
const versionController = require('../controllers/versionController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// GET /api/version
router.get('/', asyncHandler(versionController.getVersion));

module.exports = router;
