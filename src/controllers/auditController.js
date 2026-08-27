'use strict';

const auditService = require('../services/auditService');

function listAuditEvents(req, res) {
  const result = auditService.list({
    actor: req.query.actor,
    target: req.query.target,
    correlationId: req.query.correlationId,
    limit: req.query.limit,
    offset: req.query.offset,
  });
  res.json({ count: result.events.length, events: result.events, pagination: result.pagination });
}

module.exports = { listAuditEvents };
