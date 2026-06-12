'use strict';

/**
 * Wraps an async (or sync) route handler so any thrown error or rejected
 * promise is forwarded to Express's error handling chain via next().
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
