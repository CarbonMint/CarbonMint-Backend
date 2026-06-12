'use strict';

const batchService = require('../services/batchService');
const { paginate } = require('../utils/pagination');

/** GET /api/batches?page=&limit= */
function listBatches(req, res) {
  const all = batchService.listBatches();
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
  const batch = batchService.mintBatch({
    projectId,
    quantity: Number(quantity),
    vintage: Number(vintage),
    owner,
    pricePerCredit: pricePerCredit != null ? Number(pricePerCredit) : null,
  });
  res.status(201).json({ batch });
}

module.exports = { listBatches, getBatch, createBatch };
