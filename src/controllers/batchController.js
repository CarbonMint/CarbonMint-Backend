'use strict';

const batchService = require('../services/batchService');
const { paginate } = require('../utils/pagination');

/** GET /api/batches?projectId=&vintage=&status=&page=&limit= */
function listBatches(req, res) {
  const filter = {
    projectId: req.query.projectId,
    status: req.query.status,
    vintage: req.query.vintage != null ? Number(req.query.vintage) : undefined,
  };
  const all = batchService.listBatches(filter);
  const { data, pagination } = paginate(all, req.query);
  res.json({ count: data.length, pagination, batches: data });
}

/** GET /api/batches/:id */
function getBatch(req, res) {
  const batch = batchService.getBatch(req.params.id);
  res.json({ batch });
}

/** POST /api/batches */
function createBatch(req, res) {
  const { projectId, quantity, vintage, owner, pricePerCredit } = req.body;
  const idempotencyKey = req.get('Idempotency-Key') || req.body.idempotencyKey;
  if (!idempotencyKey) throw require('../utils/ApiError').badRequest('Idempotency-Key header is required');
  const batch = batchService.mintBatch({
    projectId,
    quantity: Number(quantity),
    vintage: Number(vintage),
    owner,
    pricePerCredit: pricePerCredit != null ? Number(pricePerCredit) : null,
    idempotencyKey,
  });
  res.status(201).json({ batch });
}

module.exports = { listBatches, getBatch, createBatch };
