'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Authorization middleware factory.
 *
 * Returns an Express middleware that checks whether the authenticated user
 * (set by the `authenticate` middleware) holds one of the permitted roles.
 *
 * Usage:
 *   router.post('/batches', authenticate, requireRole('admin', 'issuer'), handler)
 *
 * Responses:
 *   401 UNAUTHORIZED – `req.user` is missing (authenticate was not applied or
 *                      was bypassed; defensive guard).
 *   403 FORBIDDEN    – user is authenticated but their role is not in the
 *                      allowed list.
 *
 * @param {...string} roles - One or more role strings that are permitted.
 */
function requireRole(...roles) {
  if (roles.length === 0) {
    throw new Error('requireRole() must be called with at least one role');
  }

  return (req, _res, next) => {
    if (!req.user) {
      // Defensive: authenticate should always run first.
      return next(ApiError.unauthorized());
    }

    if (!roles.includes(req.user.role)) {
      return next(
        ApiError.forbidden(
          `Role "${req.user.role}" is not permitted to perform this action`
        )
      );
    }

    return next();
  };
}

module.exports = requireRole;
