# CarbonMint Backend

REST API for **CarbonMint**, a Stellar/Soroban tokenized carbon-credit marketplace.

CarbonMint lets verified climate projects mint tokenized carbon-credit batches,
trade them on an open marketplace, and retire (burn) credits to generate
on-chain retirement certificates. The Stellar/Soroban layer is mocked in this
backend so it can run fully in-memory with no external services.

## Stack

- Node.js + Express
- In-memory data store (seeded on boot, no database)
- Mocked Stellar/Soroban interactions via `stellarService`

## Getting started

```bash
npm install
cp .env.example .env
npm start
```

The server listens on `PORT` (default `4000`).

## API endpoints

All endpoints are namespaced under `/api`.

| Method | Path                     | Description                                  |
| ------ | ------------------------ | -------------------------------------------- |
| GET    | `/api/health`            | Liveness and runtime metadata                |
| GET    | `/api/version`           | Build/runtime version metadata               |
| GET    | `/api/projects`          | List carbon projects                         |
| GET    | `/api/projects/:id`      | Project metadata plus credit stats           |
| GET    | `/api/batches`           | List minted credit batches (paginated)       |
| GET    | `/api/batches/:id`       | Single batch detail                          |
| POST   | `/api/batches`           | Mint a new credit batch                      |
| GET    | `/api/listings`          | Batches currently for sale                   |
| POST   | `/api/buy`               | Buy credits from a listing                   |
| POST   | `/api/retire`            | Retire (burn) credits, issue a certificate   |
| GET    | `/api/certificates`      | List retirement certificates                 |
| GET    | `/api/certificates/:id`  | Single certificate detail                    |
| GET    | `/api/holdings?user=`    | A user's credit holdings                     |
| GET    | `/api/registry`          | Aggregate supply analytics                   |

### Example requests

Mint a batch:

```bash
curl -X POST http://localhost:4000/api/batches \
  -H 'Content-Type: application/json' \
  -d '{"projectId":"proj_amazon","quantity":1000,"vintage":2024,"owner":"issuer_amazon","pricePerCredit":11.0}'
```

Buy credits:

```bash
curl -X POST http://localhost:4000/api/buy \
  -H 'Content-Type: application/json' \
  -d '{"batchId":"batch_seed_amazon_2022","buyer":"alice","quantity":10}'
```

Retire credits:

```bash
curl -X POST http://localhost:4000/api/retire \
  -H 'Content-Type: application/json' \
  -d '{"batchId":"batch_seed_amazon_2022","user":"alice","quantity":5,"beneficiary":"Acme Corp"}'
```

## Conventions

### Pagination

List endpoints that can grow unbounded accept `page` (1-based, default `1`)
and `limit` (default `20`, max `100`) query parameters and return a
`pagination` block alongside the data:

```bash
curl 'http://localhost:4000/api/batches?page=1&limit=10'
```

```json
{ "pagination": { "page": 1, "limit": 10, "total": 3, "totalPages": 1 } }
```

### Request ids

Every request is tagged with a request id. Send an `X-Request-Id` header to
propagate your own correlation id, otherwise one is generated; the value is
echoed back on the `X-Request-Id` response header.

### Error format

Errors share a consistent envelope including a machine-readable `code`:

```json
{ "error": { "message": "Validation failed", "status": 400, "code": "BAD_REQUEST", "details": ["quantity must be <= 1000000"] } }
```

## Configuration

Configuration is read from environment variables (see `.env.example`):

| Variable           | Default     | Description                                    |
| ------------------ | ----------- | ---------------------------------------------- |
| `PORT`             | `4000`      | HTTP listen port                               |
| `NODE_ENV`         | `development` | Runtime environment                          |
| `LOG_LEVEL`        | `info`      | `error` \| `warn` \| `info` \| `debug`         |
| `CORS_ORIGIN`      | `*`         | Comma-separated allowlist of origins           |
| `PLATFORM_FEE_BPS` | `150`       | Marketplace platform fee in basis points       |

## Tests

Unit tests use the built-in `node:test` runner:

```bash
npm test
```

## Project structure

```
index.js                 # HTTP server bootstrap (seed + listen)
src/
  app.js                 # Express app factory (middleware + routes)
  config/                # Configuration and domain constants
  middleware/            # requestLogger, validate, notFound, errorHandler
  routes/                # Express routers, aggregated in routes/index.js
  controllers/           # Thin HTTP layer, delegates to services
  services/              # Business logic (projects, batches, market, retire)
  store/                 # In-memory store and seed data
  utils/                 # logger, ids, money, supply, pagination, ApiError
test/                    # node:test unit tests
```

The request flow is: route -> validate middleware -> controller -> service ->
in-memory store. The `stellarService` mocks all on-chain mint/transfer/burn
operations and returns deterministic transaction metadata.

## License

MIT
