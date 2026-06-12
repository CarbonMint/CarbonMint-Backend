'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Minimal body validation middleware factory.
 *
 * A schema is an object mapping field names to a rule descriptor:
 *   { type: 'string'|'number'|'integer', required: true, min, max, enum }
 *
 * Returns Express middleware that validates req.body and forwards a 400
 * ApiError describing every problem found.
 */
function validate(schema) {
  return (req, _res, next) => {
    const errors = [];
    const body = req.body || {};

    for (const [field, rule] of Object.entries(schema)) {
      const value = body[field];
      const present = value !== undefined && value !== null && value !== '';

      if (rule.required && !present) {
        errors.push(`${field} is required`);
        continue;
      }
      if (!present) continue;

      if (rule.type === 'number' || rule.type === 'integer') {
        const num = Number(value);
        if (Number.isNaN(num)) {
          errors.push(`${field} must be a number`);
          continue;
        }
        if (rule.type === 'integer' && !Number.isInteger(num)) {
          errors.push(`${field} must be an integer`);
        }
        if (rule.min !== undefined && num < rule.min) {
          errors.push(`${field} must be >= ${rule.min}`);
        }
        if (rule.max !== undefined && num > rule.max) {
          errors.push(`${field} must be <= ${rule.max}`);
        }
      }

      if (rule.type === 'string' && typeof value !== 'string') {
        errors.push(`${field} must be a string`);
      }

      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rule.enum.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      return next(ApiError.badRequest('Validation failed', errors));
    }
    return next();
  };
}

module.exports = validate;
