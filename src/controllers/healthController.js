'use strict';

const config = require('../config');
const { counts } = require('../store');

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
    store: counts(),
    timestamp: new Date().toISOString(),
  });
}

module.exports = { getHealth };
