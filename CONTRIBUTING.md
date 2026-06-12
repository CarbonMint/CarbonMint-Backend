# Contributing to CarbonMint Backend

Thanks for your interest in improving CarbonMint. This is a small Express
service with an in-memory store; the goal is to keep it simple, well-tested and
easy to reason about.

## Getting set up

```bash
npm install
cp .env.example .env
npm start
```

## Project layout

The request flow is `route -> validate middleware -> controller -> service ->
store`. Keep each layer focused:

- **routes/** wire paths to controllers and declare validation schemas.
- **controllers/** are a thin HTTP layer; they parse input and shape responses.
- **services/** hold business logic and are the only layer that touches the store.
- **utils/** are small, dependency-light, pure helpers.

## Coding conventions

- Every file starts with `'use strict';`.
- Throw `ApiError` (see `src/utils/ApiError.js`) for expected failures so the
  central error handler can render a consistent JSON envelope with a stable
  machine-readable `code`.
- Prefer adding a constant in `src/config/constants.js` over a magic value.
- Money values flow through `src/utils/money.js`; supply math through
  `src/utils/supply.js`.

## Tests

Unit tests use the built-in `node:test` runner and live under `test/`:

```bash
npm test
```

Add or update tests for any change to a util or service. New source files
should pass `node --check`.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`,
`fix:`, `docs:`, `test:`, `refactor:`, `chore:`). Keep each commit a single
coherent change.
