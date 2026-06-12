'use strict';

const { prefixedId } = require('../utils/ids');

/**
 * Request-id middleware. Honors an inbound X-Request-Id header when present
 * (so a request can be traced across services) and otherwise generates one.
 * The id is attached to req and echoed back on the response for correlation.
 */
function requestId(req, res, next) {
  const incoming = req.get('X-Request-Id');
  const id = incoming && incoming.trim() ? incoming.trim() : prefixedId('req');
  req.id = id;
  res.set('X-Request-Id', id);
  next();
}

module.exports = requestId;
