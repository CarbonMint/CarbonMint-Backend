'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Catch-all middleware for unmatched routes. Forwards a 404 ApiError to the
 * central error handler.
 */
function notFound(req, _res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

module.exports = notFound;
