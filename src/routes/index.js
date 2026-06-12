'use strict';

const express = require('express');

const healthRoutes = require('./healthRoutes');
const projectRoutes = require('./projectRoutes');
const batchRoutes = require('./batchRoutes');
const marketRoutes = require('./marketRoutes');
const retirementRoutes = require('./retirementRoutes');
const holdingsRoutes = require('./holdingsRoutes');
const registryRoutes = require('./registryRoutes');

const router = express.Router();

/**
 * Mounts every domain router under the /api namespace. The market and
 * retirement routers expose top-level paths (/listings, /buy, /retire,
 * /certificates) so they are mounted at the api root.
 */
router.use('/health', healthRoutes);
router.use('/projects', projectRoutes);
router.use('/batches', batchRoutes);
router.use('/holdings', holdingsRoutes);
router.use('/registry', registryRoutes);
router.use('/', marketRoutes);
router.use('/', retirementRoutes);

module.exports = router;
