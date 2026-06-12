# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/), and the project adheres to
semantic versioning.

## [Unreleased]

### Added

- `GET /api/health/live` and `GET /api/health/ready` liveness/readiness probes.
- `GET /api/market/stats` with a price distribution summary.
- `GET /api/projects/top` ranking projects by credits minted.
- `GET /api/holdings/summary` aggregating a holder's credits by project.
- Filtering of certificates by `user`/`projectId` and batches by
  `projectId`/`vintage`/`status`.
- Security headers middleware, a request timeout middleware and a JSON payload
  size guard.
- Numeric statistics helpers (`src/utils/stats.js`) and a retirement projection
  helper in `src/utils/supply.js`, both covered by `node:test` suites.
- Registry standards and vintage range constants, with vintage bounds enforced
  at the mint route and service.
- `413`, `429` and `503` error factories and default codes.
- `JSON_BODY_LIMIT` and `REQUEST_TIMEOUT_MS` configuration options.
- Blue-carbon and direct-air-capture demo projects and batches in the seed data.

## [0.1.0]

### Added

- Initial CarbonMint backend: projects, batch minting, marketplace listings and
  buy flow, retirement with certificates, holdings, registry analytics, health
  and version endpoints, request-id correlation and pagination.
