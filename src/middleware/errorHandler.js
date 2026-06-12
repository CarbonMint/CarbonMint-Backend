'use strict';

const logger = require('../utils/logger');

/**
 * Central error handler. Translates thrown errors into a consistent JSON
 * envelope. Operational ApiErrors carry their own status code; anything else
 * is treated as an unexpected 500.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    logger.error('Unhandled error:', err.message, err.stack);
  } else {
    logger.warn(`${statusCode} on ${req.method} ${req.originalUrl}: ${err.message}`);
  }

  res.status(statusCode).json({
    error: {
      message: err.message || 'Internal Server Error',
      status: statusCode,
      details: err.details,
    },
  });
}

module.exports = errorHandler;
