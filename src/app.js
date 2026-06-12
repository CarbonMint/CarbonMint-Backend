'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const config = require('./config');
const apiRoutes = require('./routes');
const requestId = require('./middleware/requestId');
const requestLogger = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

/**
 * Builds and configures the Express application. Kept separate from the HTTP
 * server bootstrap (index.js) so it can be imported in isolation, e.g. for
 * tests.
 */
function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(morgan(config.env === 'development' ? 'dev' : 'combined'));
  app.use(requestId);
  app.use(requestLogger);

  app.get('/', (_req, res) => {
    res.json({
      name: 'CarbonMint API',
      version: require('../package.json').version,
      docs: '/api/health',
    });
  });

  app.use('/api', apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
