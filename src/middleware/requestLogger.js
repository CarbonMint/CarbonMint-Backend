'use strict';

const logger = require('../utils/logger');

/**
 * Lightweight request logger middleware. Logs method, path and response time.
 * Complements morgan with structured debug output controlled by LOG_LEVEL.
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    logger.debug(`${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms}ms)`);
  });
  next();
}

module.exports = requestLogger;
