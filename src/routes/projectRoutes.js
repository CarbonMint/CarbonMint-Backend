'use strict';

const express = require('express');
const projectController = require('../controllers/projectController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// GET /api/projects
router.get('/', asyncHandler(projectController.listProjects));

// GET /api/projects/top (registered before /:id so it is not shadowed)
router.get('/top', asyncHandler(projectController.topProjects));

// GET /api/projects/:id
router.get('/:id', asyncHandler(projectController.getProject));

module.exports = router;
