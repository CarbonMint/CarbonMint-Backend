'use strict';

const retirementService = require('../services/retirementService');
const ApiError = require('../utils/ApiError');

/** POST /api/retire */
function retire(req, res) {
  const { batchId, user, quantity, beneficiary, reason, retirementId } = req.body;
  if (user !== req.user.id) {
    throw ApiError.forbidden('Retirement user must match the authenticated user');
  }
  const certificate = retirementService.retire({
    batchId,
    user: req.user.id,
    quantity: Number(quantity),
    beneficiary,
    reason,
    retirementId,
  });
  res.status(201).json({ certificate });
}

/** GET /api/certificates?user=&projectId= */
function listCertificates(req, res) {
  const certificates = retirementService.listCertificates({
    user: req.query.user,
    projectId: req.query.projectId,
  });
  res.json({ count: certificates.length, certificates });
}

/** GET /api/certificates/:id */
function getCertificate(req, res) {
  const certificate = retirementService.getCertificate(req.params.id, {
    user: req.query.user,
  });
  res.json({ certificate });
}

/** PATCH /api/certificates/:id — admin-only append-only correction. */
function correctCertificate(req, res) {
  const certificate = retirementService.correctCertificate({
    id: req.params.id,
    actor: req.user.id,
    beneficiary: req.body.beneficiary,
    reason: req.body.reason,
    correctionReason: req.body.correctionReason,
  });
  res.json({ certificate });
}

module.exports = { retire, listCertificates, getCertificate, correctCertificate };
