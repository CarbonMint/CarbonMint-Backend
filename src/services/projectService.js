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

module.exports = { listProjects, getProject, projectExists };
