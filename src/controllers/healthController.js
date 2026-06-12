'use strict';

const config = require('../config');

/**
 * Health controller. Reports liveness plus a little build/runtime metadata
 * that is handy for uptime checks and smoke tests.
 */
function getHealth(_req, res) {
  res.json({
    status: 'ok',
    service: 'carbonmint-backend',
    env: config.env,
    network: config.stellar.network,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}

module.exports = { getHealth };
