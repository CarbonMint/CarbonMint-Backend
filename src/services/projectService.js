'use strict';

const { store } = require('../store');
const ApiError = require('../utils/ApiError');

/**
 * Project service. Carbon projects are the verified climate initiatives that
 * back minted credit batches (reforestation, renewable energy, etc.).
 */
function listProjects() {
  return Array.from(store.projects.values());
}

function getProject(id) {
  const project = store.projects.get(id);
  if (!project) {
    throw ApiError.notFound(`Project ${id} not found`);
  }
  return project;
}

function projectExists(id) {
  return store.projects.has(id);
}

/**
 * Aggregate minted/retired credit totals for a single project across all of
 * its batches.
 */
function getProjectStats(id) {
  let minted = 0;
  let retired = 0;
  let available = 0;
  let batchCount = 0;

  for (const batch of store.batches.values()) {
    if (batch.projectId !== id) continue;
    minted += batch.quantity;
    retired += batch.retired;
    available += batch.available;
    batchCount += 1;
  }

  return { minted, retired, available, batchCount };
}

/**
 * Rank projects by total credits minted across their batches, descending.
 * Returns each project with its aggregated stats, capped at `limit` entries.
 */
function topProjects(limit = 5) {
  const safeLimit = Number.isInteger(limit) && limit > 0 ? limit : 5;
  return listProjects()
    .map((project) => ({ project, stats: getProjectStats(project.id) }))
    .sort((a, b) => b.stats.minted - a.stats.minted)
    .slice(0, safeLimit);
}

module.exports = {
  listProjects,
  getProject,
  projectExists,
  getProjectStats,
  topProjects,
};
