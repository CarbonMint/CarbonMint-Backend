'use strict';

const retirementService = require('../services/retirementService');

/** POST /api/retire */
function retire(req, res) {
  const { batchId, user, quantity, beneficiary, reason } = req.body;
  const certificate = retirementService.retire({
    batchId,
    user,
    quantity: Number(quantity),
    beneficiary,
    reason,
  });
  res.status(201).json({ certificate });
}

/** GET /api/certificates */
function listCertificates(_req, res) {
  const certificates = retirementService.listCertificates();
  res.json({ count: certificates.length, certificates });
}

/** GET /api/certificates/:id */
function getCertificate(req, res) {
  const certificate = retirementService.getCertificate(req.params.id);
  res.json({ certificate });
}

module.exports = { retire, listCertificates, getCertificate };
