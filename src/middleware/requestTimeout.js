'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Request timeout middleware factory. Guards against handlers that never
 * respond by failing the request after `ms` milliseconds with a 503. The timer
 * is cleared once the response finishes so fast requests are unaffected.
 */
function requestTimeout(ms = 15000) {
  return (req, res, next) => {
    if (!ms || ms <= 0) return next();

    const timer = setTimeout(() => {
      if (!res.headersSent) {
        next(
          new ApiError(503, 'Request timed out', undefined, 'REQUEST_TIMEOUT')
        );
      }
    }, ms);

    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
}

module.exports = requestTimeout;
