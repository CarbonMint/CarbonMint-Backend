'use strict';

require('dotenv').config();

/**
 * Centralized application configuration.
 * Values are read from environment variables with sane defaults so the
 * service can boot without an .env file present.
 */
const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 4000,
  logLevel: process.env.LOG_LEVEL || 'info',
  // Comma-separated allowlist of origins. '*' (default) allows any origin,
  // which is convenient in development but should be tightened in production.
  corsOrigins: (process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  // Maximum accepted JSON request body size. Accepts any value the body-parser
  // understands (e.g. '100kb', '1mb').
  jsonBodyLimit: process.env.JSON_BODY_LIMIT || '100kb',
  // Per-request timeout in milliseconds. Set to 0 to disable.
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS, 10) || 15000,
  stellar: {
    network: process.env.STELLAR_NETWORK || 'testnet',
    horizonUrl:
      process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
    contractId: process.env.SOROBAN_CONTRACT_ID || 'CMINTMOCK',
  },
  marketplace: {
    platformFeeBps: parseInt(process.env.PLATFORM_FEE_BPS, 10) || 150,
  },
};

module.exports = config;
