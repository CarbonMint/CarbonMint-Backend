'use strict';

const express = require('express');
const registryController = require('../controllers/registryController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// GET /api/registry
router.get('/', asyncHandler(registryController.getRegistry));

module.exports = router;
