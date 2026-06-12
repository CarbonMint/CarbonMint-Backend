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

## License

MIT
