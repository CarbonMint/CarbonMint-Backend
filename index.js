'use strict';

const createApp = require('./src/app');
const config = require('./src/config');
const logger = require('./src/utils/logger');
const { seed } = require('./src/store/seed');

/**
 * HTTP server bootstrap. Seeds the in-memory store, builds the app and starts
 * listening. Handles graceful shutdown on SIGINT/SIGTERM.
 */
function start() {
  seed();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info(
      `CarbonMint API listening on port ${config.port} [${config.env}]`
    );
  });

  const shutdown = (signal) => {
    logger.info(`Received ${signal}, shutting down...`);
    server.close(() => {
      logger.info('Server closed. Goodbye.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

start();
