'use strict';

const config = require('../config');
const { counts, queueDepth } = require('../store');
const ApiError = require('../utils/ApiError');

/**
 * Health controller. Reports liveness plus a little build/runtime metadata
 * that is handy for uptime checks and smoke tests. Includes queue-depth
 * breakdown so operators can monitor the processing pipeline at a glance.
 */
function getHealth(_req, res) {
  res.json({
    status: 'ok',
    service: 'carbonmint-backend',
    env: config.env,
    network: config.stellar.network,
    uptime: process.uptime(),
    store: counts(),
    queue: queueDepth(),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Liveness probe. Answers "is the process up?" with the minimum work possible,
 * suitable for a Kubernetes livenessProbe that should never depend on state.
 */
function getLiveness(_req, res) {
  res.json({ status: 'alive', uptime: process.uptime() });
}

/**
 * Readiness probe. Answers "can the service handle traffic?" by checking the
 * store has been seeded with projects. Returns 503 when not yet ready so an
 * orchestrator holds traffic back.
 */
function getReadiness(_req, res) {
  const store = counts();
  if (store.projects === 0) {
    throw ApiError.serviceUnavailable('Store not seeded');
  }
  res.json({ status: 'ready', store });
}

module.exports = { getHealth, getLiveness, getReadiness };
