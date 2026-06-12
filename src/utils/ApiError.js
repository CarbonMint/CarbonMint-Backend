'use strict';

/**
 * Operational error carrying an HTTP status code. Thrown by services and
 * controllers and translated into a JSON response by the errorHandler
 * middleware.
 */
// Default machine-readable code per HTTP status, used when a caller does not
// supply an explicit one. Lets clients branch on a stable string instead of
// parsing human-facing messages.
const DEFAULT_CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
};

class ApiError extends Error {
  constructor(statusCode, message, details, code) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code || DEFAULT_CODES[statusCode] || 'ERROR';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message) {
    return new ApiError(409, message);
  }

  static unprocessable(message, details) {
    return new ApiError(422, message, details);
  }
}

module.exports = ApiError;
