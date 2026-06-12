'use strict';

const config = require('../config');
const pkg = require('../../package.json');

/**
 * Version controller. Exposes build/runtime metadata that clients and CI
 * smoke tests can pin against without parsing the human-facing root response.
 */
function getVersion(_req, res) {
  res.json({
    name: pkg.name,
    version: pkg.version,
    env: config.env,
    network: config.stellar.network,
    node: process.version,
  });
}

module.exports = { getVersion };
