# CarbonMint lifecycle audit events

CarbonMint records structured audit events for minting, marketplace transfers,
and credit retirement. The event is written after the corresponding domain
state transition succeeds and carries enough bounded context to investigate a
request without copying provider payloads or credentials.

## Schema

```json
{
  "id": "audit_…",
  "version": 1,
  "actor": "buyer_test",
  "action": "market.buy",
  "target": "batch_…",
  "correlationId": "req_…",
  "outcome": "success",
  "metadata": {
    "quantity": 20,
    "txHash": "stellar_tx_…"
  },
  "occurredAt": "2026-08-24T00:00:00.000Z"
}
```

| Field | Rule |
| --- | --- |
| `id` | Server-generated unique event ID. |
| `version` | Numeric schema version, currently `1`. |
| `actor` | Authenticated user responsible for the operation. |
| `action` | Stable lifecycle action name. |
| `target` | Batch, registry, or resource affected. |
| `correlationId` | Request ID propagated from HTTP middleware. |
| `outcome` | `success` or `failure`. |
| `metadata` | Bounded redacted operation context. |
| `occurredAt` | Server-generated ISO timestamp. |

## Covered operations

`batch.mint` records project, quantity, vintage, owner, price, and the provider
transaction hash after the batch and issuer holding are stored. `market.buy`
records seller, buyer, quantity, settlement amounts, and provider hash after
holdings and availability are updated. `credits.retire` records the certificate
ID, retiring user, quantity, beneficiary, reason, and burn hash after supply
accounting and certificate storage succeed.

These events are intentionally operation-focused rather than full snapshots.
Consumers should load current resources by ID when they need a complete view,
while using the event metadata to explain what changed and which request caused
it.

## Ordering and atomicity

The in-memory implementation writes the event after the local state update. A
production persistence adapter must use a database transaction or a
transactional outbox so a committed mutation cannot lose its audit handoff.
Provider submission occurs before local mutation; provider failures are
normalized and do not produce a success audit event.

An event cannot prove that a provider settled permanently by itself. Its
transaction hash should be reconciled with the provider ledger and the local
state transition. Ambiguous provider responses must be handled by the domain
operation before an audit success is recorded.

## Query API

Admins can query `GET /api/audit` after normal header authentication. Optional
filters are exact `actor`, `target`, and `correlationId` values, with bounded
`limit` and `offset` pagination. Events are returned newest first and the
response includes the effective pagination values.

Audit reads are not public marketplace reads. They require the admin role so
operator metadata and investigation context are not exposed to buyers or
anonymous callers. Access logging should be enabled by a persistent adapter.

## Redaction

The sanitizer runs before insertion into the in-memory store. Strings are
limited to 256 characters and object/array entries are limited to 24. Keys
containing `secret`, `token`, `password`, `credential`, `privateKey`, or
`mnemonic` are replaced with `[REDACTED]`. Unknown nested objects are bounded
and sensitive descendants are redacted.

Provider messages are never copied into event metadata. Store safe provider
transaction IDs and normalized codes instead. This protects event consumers,
logs, future persistence, and admin exports from accidental credential leaks.

## Correlation

`requestId` creates or accepts `X-Request-Id`, the controllers pass `req.id` to
the services, and the service writes it as `correlationId`. Support tooling can
join an audit event with request logs, the HTTP response, provider calls, and
downstream traces. Direct service calls without a request context use
`unknown` and should be treated as lower-confidence telemetry.

## Consumer guidance

- Branch on `version` and `action`, not on display text.
- Ignore additive fields within version 1.
- Treat event IDs as unique and keep them when exporting.
- Use correlation IDs to join evidence across systems.
- Do not use audit events as a replacement for ledger reconciliation.
- Never render metadata as trusted HTML.
- Preserve redaction when forwarding events to analytics.
- Keep admin audit access separate from public certificate verification.

## Persistence and retention

The current repository is explicitly in-memory, so audit history is lost on a
process restart just like other store collections. Production use requires a
durable append-only collection, retention policy, access audit, and indexes on
actor, target, correlation ID, and timestamp. A migration must preserve version
1 event meaning and must not rewrite historical evidence.

Recommended persistence controls include a unique event ID, immutable payload
columns, encrypted storage at rest, role-controlled reads, bounded exports,
and a separate operational metric for append failures. Deletion should require
an explicit retention workflow rather than a normal application endpoint.

## Rollout and rollback

The endpoint and collection are additive; existing marketplace and certificate
responses remain compatible. Consumers may adopt events incrementally. If the
feature is rolled back, no batch, holding, certificate, or provider migration
is required. A durable deployment should drain or quarantine pending writes
before rollback so operators know which transitions lack an audit record.

## Review checklist

- State mutation succeeds before success event insertion.
- Provider exceptions are normalized and do not claim success.
- Exactly one event is emitted per covered operation.
- Actor and correlation ID are present.
- Metadata is bounded and redacted before storage.
- Admin-only query authorization is enforced.
- Actor, target, and correlation filters are tested.
- Provider hashes are safe identifiers, not raw responses.
- Schema version is asserted in tests.
- Full CI passes with no disabled or deleted checks.

## Operational examples

The following examples describe expected records without prescribing a durable
storage implementation. They are useful when comparing an incident report with
the event stream or when writing a persistence adapter.

### Successful mint

```json
{
  "version": 1,
  "actor": "issuer-42",
  "action": "carbon.mint",
  "target": "batch:batch_123",
  "correlationId": "req_abc",
  "outcome": "success",
  "metadata": {
    "batchId": "batch_123",
    "holdingId": "holding_456",
    "amount": 25
  }
}
```

### Failed provider call

A failed provider call is represented by the provider error response and no
successful lifecycle record. If a future implementation records failures, it
must use `outcome: "failure"` and must never reuse the success action as a
shortcut. This distinction prevents dashboards from counting an attempted mint
as issued.

### Correlation workflow

1. The HTTP boundary obtains the request identifier.
2. The service receives that identifier as an explicit option.
3. The service records the identifier after the state transition.
4. Support queries the identifier together with the affected target.
5. The provider reference is compared with the domain record before reconciliation.

If any step cannot preserve the identifier, the operation should fail closed or
use the documented `unknown` value rather than inventing a second request ID.

## Retention and export guidance

Audit records can contain business identifiers, so exports must be access
controlled and time-limited. Export jobs should:

- select by a bounded time window and explicit actor, target, or correlation;
- preserve the event ID and version when copying records;
- keep the redacted metadata shape unchanged;
- record who initiated the export in a separate administrative event; and
- delete temporary export files using the platform's approved retention process.

Consumers should tolerate additional fields in version 1, but should reject an
unknown version until its redaction and authorization semantics are reviewed.

## Backfill guidance

Backfills must not manufacture historical success events. A migration may copy
an existing event only when its original actor, target, timestamp, and outcome
are known. Missing values must be marked as unavailable in migration metadata,
and the migration itself should be traceable by a correlation ID. Re-running a
backfill should be idempotent by source event ID.
