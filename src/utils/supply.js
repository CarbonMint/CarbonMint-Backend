'use strict';

/**
 * Supply math helpers. Centralizes the credit accounting identities used by
 * the registry and project analytics so the same rules are applied
 * everywhere: minted == available + retired + sold-through.
 */

/** Aggregate minted/retired/available totals across a list of batches. */
function aggregateSupply(batches) {
  let minted = 0;
  let retired = 0;
  let available = 0;

  for (const batch of batches) {
    minted += batch.quantity;
    retired += batch.retired;
    available += batch.available;
  }

  return { minted, retired, available };
}

/**
 * Fraction of minted credits that have been retired, expressed as a value in
 * [0, 1]. Returns 0 when nothing has been minted to avoid division by zero.
 */
function retirementRate(minted, retired) {
  if (!minted || minted <= 0) return 0;
  return retired / minted;
}

module.exports = { aggregateSupply, retirementRate };
