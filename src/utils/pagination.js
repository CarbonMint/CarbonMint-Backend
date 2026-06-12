'use strict';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Pagination helpers. Parses page/limit query parameters into safe bounds and
 * slices an in-memory array, returning the page plus the metadata clients need
 * to render pagers without a second count request.
 */
function parseParams(query = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (!Number.isInteger(page) || page < 1) page = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  return { page, limit };
}

function paginate(items, query = {}) {
  const { page, limit } = parseParams(query);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const data = items.slice(offset, offset + limit);

  return {
    data,
    pagination: { page, limit, total, totalPages },
  };
}

module.exports = { parseParams, paginate, DEFAULT_LIMIT, MAX_LIMIT };
