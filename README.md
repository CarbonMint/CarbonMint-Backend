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
| GET    | `/api/projects`          | List carbon projects                         |
| GET    | `/api/projects/:id`      | Project metadata plus credit stats           |
| GET    | `/api/batches`           | List all minted credit batches               |
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

## License

MIT
