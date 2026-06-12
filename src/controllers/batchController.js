'use strict';

const batchService = require('../services/batchService');

/** GET /api/batches */
function listBatches(_req, res) {
  const batches = batchService.listBatches();
  res.json({ count: batches.length, batches });
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
