'use strict';

const marketService = require('../services/marketService');

/** GET /api/listings */
function listListings(_req, res) {
  const listings = marketService.listListings();
  res.json({ count: listings.length, listings });
}

/** POST /api/buy */
function buy(req, res) {
  const { batchId, buyer, quantity } = req.body;
  const receipt = marketService.buy({
    batchId,
    buyer,
    quantity: Number(quantity),
  });
  res.status(201).json({ receipt });
}

module.exports = { listListings, buy };
