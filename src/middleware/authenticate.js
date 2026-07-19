'use strict';

const { store } = require('../store');
const { ROLES } = require('../config/roles');
const ApiError = require('../utils/ApiError');

/**
 * Authentication middleware.
 *
 * Reads the `X-User-Id` and `X-User-Role` headers from the request, validates
 * them against the in-memory users map, and attaches a `req.user` object to
 * the request so downstream middleware and controllers can rely on it.
 *
 * Authentication is intentionally header-based (rather than JWT/session) to
 * match the project's fully-in-memory, no-external-services philosophy.
 *
 * Header protocol
 * ---------------
 *   X-User-Id   : the user's id string (must match a key in store.users)
 *   X-User-Role : the user's role string (must be a recognized ROLES value)
 *
 * On success  : sets req.user = { id, role } and calls next().
 * On failure  : forwards a 401 ApiError – the route never executes.
 *
 * Routes that do NOT require authentication should skip this middleware.
 */
function authenticate(req, _res, next) {
  const userId = (req.get('X-User-Id') || '').trim();
  const userRole = (req.get('X-User-Role') || '').trim();

  if (!userId || !userRole) {
    return next(
      ApiError.unauthorized(
        'Authentication required: provide X-User-Id and X-User-Role headers'
      )
    );
  }

  // Validate the role value before touching the store.
  if (!Object.values(ROLES).includes(userRole)) {
    return next(
      ApiError.unauthorized(`Unrecognized role: "${userRole}"`)
    );
  }

  // Look the user up in the in-memory store.
  const user = store.users.get(userId);
  if (!user) {
    return next(
      ApiError.unauthorized(`Unknown user: "${userId}"`)
    );
  }

  // The role in the header must match the persisted role to prevent privilege
  // escalation by simply sending a different header value.
  if (user.role !== userRole) {
    return next(
      ApiError.unauthorized('User id and role do not match')
    );
  }

  req.user = { id: user.id, role: user.role };
  return next();
}

module.exports = authenticate;
