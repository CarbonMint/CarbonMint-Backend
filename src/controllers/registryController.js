'use strict';

const registryService = require('../services/registryService');

/** GET /api/registry */
function getRegistry(_req, res) {
  const stats = registryService.getRegistryStats();
  res.json({ registry: stats });
}

module.exports = { getRegistry };
