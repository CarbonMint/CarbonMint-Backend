'use strict';

const projectService = require('../services/projectService');

/** GET /api/projects */
function listProjects(_req, res) {
  const projects = projectService.listProjects();
  res.json({ count: projects.length, projects });
}

/** GET /api/projects/top?limit= */
function topProjects(req, res) {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const projects = projectService.topProjects(limit);
  res.json({ count: projects.length, projects });
}

/** GET /api/projects/:id */
function getProject(req, res) {
  const project = projectService.getProject(req.params.id);
  const stats = projectService.getProjectStats(req.params.id);
  res.json({ project, stats });
}

module.exports = { listProjects, topProjects, getProject };
