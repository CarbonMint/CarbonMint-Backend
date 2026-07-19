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

| Method | Path                     | Auth required | Description                                  |
| ------ | ------------------------ | ------------- | -------------------------------------------- |
| GET    | `/api/health`            | –             | Liveness and runtime metadata                |
| GET    | `/api/health/live`       | –             | Liveness probe (process up)                  |
| GET    | `/api/health/ready`      | –             | Readiness probe (store seeded)               |
| GET    | `/api/version`           | –             | Build/runtime version metadata               |
| GET    | `/api/projects`          | –             | List carbon projects                         |
| GET    | `/api/projects/top`      | –             | Top projects ranked by credits minted        |
| GET    | `/api/projects/:id`      | –             | Project metadata plus credit stats           |
| GET    | `/api/batches`           | –             | List minted credit batches (paginated)       |
| GET    | `/api/batches/:id`       | –             | Single batch detail                          |
| POST   | `/api/batches`           | `admin`, `issuer` | Mint a new credit batch                 |
| GET    | `/api/listings`          | –             | Batches currently for sale                   |
| GET    | `/api/market/stats`      | –             | Aggregate listing/price statistics           |
| POST   | `/api/buy`               | any role      | Buy credits from a listing                   |
| POST   | `/api/retire`            | any role      | Retire (burn) credits, issue a certificate   |
| GET    | `/api/certificates`      | –             | List certificates (filter by `user`/`projectId`) |
| GET    | `/api/certificates/:id`  | –             | Single certificate detail                    |
| GET    | `/api/holdings?user=`    | –             | A user's credit holdings                     |
| GET    | `/api/holdings/summary?user=` | –        | Holdings aggregated by project               |
| GET    | `/api/registry`          | –             | Aggregate supply analytics                   |

List endpoints accept filters: `/api/batches` supports `projectId`, `vintage`
and `status`; `/api/listings` supports `projectId`.

### Example requests

Mint a batch:

```bash
curl -X POST http://localhost:4000/api/batches \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: issuer_amazon' \
  -H 'X-User-Role: issuer' \
  -d '{"projectId":"proj_amazon","quantity":1000,"vintage":2024,"owner":"issuer_amazon","pricePerCredit":11.0}'
```

Buy credits:

```bash
curl -X POST http://localhost:4000/api/buy \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: buyer_alice' \
  -H 'X-User-Role: buyer' \
  -d '{"batchId":"batch_seed_amazon_2022","buyer":"buyer_alice","quantity":10}'
```

Retire credits:

```bash
curl -X POST http://localhost:4000/api/retire \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: buyer_alice' \
  -H 'X-User-Role: buyer' \
  -d '{"batchId":"batch_seed_amazon_2022","user":"buyer_alice","quantity":5,"beneficiary":"Acme Corp"}'
```

## Role-Based Access Control (RBAC)

### Overview

CarbonMint uses a lightweight, header-based RBAC system. Every write request on
a protected endpoint must carry two HTTP headers that identify the caller and
their role. The server validates the headers against the in-memory users store.

```
X-User-Id:   <user-id>
X-User-Role: <role>
```

This approach keeps the system fully in-memory with no external auth service,
consistent with the project's philosophy.

### Available roles

| Role     | Description                                                         |
| -------- | ------------------------------------------------------------------- |
| `admin`  | Platform operator. Can perform any action including minting batches |
| `issuer` | Verified project owner. Can mint credit batches and trade credits   |
| `buyer`  | Regular marketplace participant. Can buy and retire credits         |

### Protected endpoints

| Method | Path          | Allowed roles            | Denied roles |
| ------ | ------------- | ------------------------ | ------------ |
| POST   | `/api/batches`| `admin`, `issuer`        | `buyer`      |
| POST   | `/api/buy`    | `admin`, `issuer`, `buyer` | –           |
| POST   | `/api/retire` | `admin`, `issuer`, `buyer` | –           |

All `GET` endpoints remain public — no authentication is required to read
projects, batches, listings, certificates, holdings, or registry data.

### HTTP status codes

| Situation                                    | Status | Code            |
| -------------------------------------------- | ------ | --------------- |
| Missing or invalid headers                   | `401`  | `UNAUTHORIZED`  |
| User id not found in store                   | `401`  | `UNAUTHORIZED`  |
| Header role does not match stored role       | `401`  | `UNAUTHORIZED`  |
| Authenticated but role is not permitted      | `403`  | `FORBIDDEN`     |

### Authorization flow

```
Request
  │
  ├─ authenticate middleware
  │    Reads X-User-Id + X-User-Role headers
  │    Validates against store.users map
  │    Sets req.user = { id, role }     ──► 401 on any failure
  │
  ├─ requireRole(...roles) middleware
  │    Checks req.user.role is in the allowed list ──► 403 if not permitted
  │
  └─ validate middleware → controller → service → store
```

### Seed users

The following users are seeded on boot for local development and testing:

| User id           | Role     |
| ----------------- | -------- |
| `admin_platform`  | `admin`  |
| `issuer_amazon`   | `issuer` |
| `issuer_solar`    | `issuer` |
| `issuer_kenya`    | `issuer` |
| `issuer_mangrove` | `issuer` |
| `issuer_dac`      | `issuer` |
| `buyer_alice`     | `buyer`  |
| `buyer_bob`       | `buyer`  |

### Example authenticated requests

Mint a batch (issuer):

```bash
curl -X POST http://localhost:4000/api/batches \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: issuer_amazon' \
  -H 'X-User-Role: issuer' \
  -d '{"projectId":"proj_amazon","quantity":500,"vintage":2024,"owner":"issuer_amazon","pricePerCredit":13.0}'
```

Buy credits (buyer):

```bash
curl -X POST http://localhost:4000/api/buy \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: buyer_alice' \
  -H 'X-User-Role: buyer' \
  -d '{"batchId":"batch_seed_amazon_2022","buyer":"buyer_alice","quantity":10}'
```

Retire credits (buyer):

```bash
curl -X POST http://localhost:4000/api/retire \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: buyer_alice' \
  -H 'X-User-Role: buyer' \
  -d '{"batchId":"batch_seed_amazon_2022","user":"buyer_alice","quantity":5,"beneficiary":"Acme Corp"}'
```

### How to add a new role

1. Add the role constant to `src/config/roles.js` under `ROLES`.
2. Update or create a permission set (`MINT_ROLES`, `TRADE_ROLES`, etc.) to
   include the new role where appropriate.
3. Seed at least one user with the new role in `src/store/seed.js`.
4. Apply `requireRole('new_role', ...)` to any routes the role should access.
5. Add test cases in `test/rbac.test.js` covering authorized and denied access.
6. Update this table and the protected endpoints table above.

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
| `JSON_BODY_LIMIT`  | `100kb`     | Maximum accepted JSON request body size        |
| `REQUEST_TIMEOUT_MS` | `15000`   | Per-request timeout in ms (`0` disables)       |
| `PLATFORM_FEE_BPS` | `150`       | Marketplace platform fee in basis points       |

### Security headers

Responses include conservative security headers (`X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, a strict `Content-Security-Policy`) and the
`X-Powered-By` banner is removed.

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
