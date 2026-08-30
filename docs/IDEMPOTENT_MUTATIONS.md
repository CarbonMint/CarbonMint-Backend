# Idempotent CarbonMint mutations

Minting, buying, transferring, and retiring carbon credits are side effects.
Clients often retry after a timeout, but the provider or local process may have
already committed the first request. This contract makes a safe retry return
the original terminal result rather than minting supply, creating a second
certificate, or moving holdings twice.

## Request contract

Every mutation API accepts an `Idempotency-Key` header. The key is 8–128
characters from the safe set `[A-Za-z0-9._:-]`. A body field with the same name
is accepted by the controller for compatibility, but the header is the
recommended transport.

The key is scoped by authenticated actor and command. The request fingerprint
also includes every mutation input. The same key is therefore independent for
`mint`, `buy`, and `retire`, and independent for two actors using the same
client-generated value.

```http
POST /api/batches
Idempotency-Key: mint-2026-000001
Content-Type: application/json

{"projectId":"project-1","quantity":100,"vintage":2026,"owner":"issuer-1"}
```

## Outcomes

| Situation | Result |
| --- | --- |
| First valid request | Execute once, persist terminal result, append one audit event |
| Same actor/command/key and same payload | Return the stored result; do not call the provider |
| Same scope/key and different payload | `409 IDEMPOTENCY_CONFLICT` |
| Missing/invalid key at an API boundary | `400` client error |
| Mutation fails before a terminal result | Do not cache the failure; a corrected retry may run |

The result is stored after the mutation completes. The current application
uses an in-process store, so records survive retries within a process but not a
process restart. A production database adapter must move the record and
business mutation into one transaction or durable outbox protocol before
horizontal deployment.

## Mutation coverage

### Mint

The mint command fingerprints project, quantity, vintage, owner, and price.
Only the first execution calls the Stellar adapter, inserts the batch, and
credits holdings. A retry returns the same batch and transaction hash.

### Buy/transfer

The buy command fingerprints batch, buyer, and quantity. Only the first
execution calls the transfer adapter and adjusts seller/buyer holdings. The
stored receipt is returned for retries, including the original settlement
timestamp and provider hash.

### Retirement

Retirement already supports its legacy `retirementId` path. New API callers
should use `Idempotency-Key`; it uses the same actor/command/payload record and
returns the original certificate without burning twice. The legacy key remains
compatible for existing callers.

## Concurrency

The mutation functions are synchronous in the current in-memory backend, so
JavaScript execution cannot interleave two calls between lookup and write. The
record is checked before the provider call and written only after success.

When replacing the store with a database, use a unique constraint over
`(actor_id, command, idempotency_key)`, compare the stored fingerprint under a
transaction, and lock the row while the terminal result is being written.
Concurrent requests with the same fingerprint should wait for or read the one
terminal result. Never allow two provider calls merely because two workers
arrived at the same time.

The first request may time out at the client while it continues in the server.
The client must reuse the same key and identical payload when retrying. A new
key means a new command and may create a second side effect.

## Provider uncertainty

An upstream response can be lost after the provider commits. The idempotency
record is what converts that ambiguous network outcome into a safe retry once
the server has recorded the terminal result. For a real external provider,
send the same provider idempotency key or transaction reference derived from
the request key. Do not generate a fresh provider key for a client retry.

If the process dies between provider acceptance and local persistence, the
current in-memory implementation cannot prove the outcome. Reconciliation
must query the provider by its stable reference before a new mutation is
allowed. This is a rollout limitation, not a reason to weaken conflict checks.

## Audit events

Each successful first execution appends one event containing actor, command,
client key, payload fingerprint, and creation time. Retries do not append a
second business audit event. Operational request logs may record retry counts,
but must not duplicate supply or settlement events.

Audit records must not contain raw secrets, credentials, or full sensitive
payloads. The SHA-256 fingerprint supports conflict diagnosis without making
the audit stream a copy of the request body.

## Rollout checklist

- [ ] Generate a unique key per logical mutation and reuse it on client retry.
- [ ] Authenticate the actor before deriving the idempotency scope.
- [ ] Keep the payload stable across retries.
- [ ] Map `IDEMPOTENCY_CONFLICT` to a clear 409 response.
- [ ] Verify provider calls and audit events occur once in tests.
- [ ] Add durable storage and a uniqueness constraint before multi-process use.
- [ ] Reconcile accepted-but-unrecorded provider operations after restart.
- [ ] Monitor conflict rate and stale/incomplete records.
- [ ] Never remove tests or bypass the key requirement to make a request pass.

The issue-specific tests cover terminal replay, canonical payload fingerprints,
scope isolation, invalid keys, and failure recovery. Endpoint integration
tests should additionally assert that duplicate HTTP requests return the same
JSON response and that provider mocks are called once.

## Durable adapter design

The in-memory implementation keeps the example application deterministic, but
the interface should be preserved when moving to a database. A durable record
needs these fields:

```text
actor_id             authenticated actor
command              mint, buy, or retire
idempotency_key      client supplied key
request_fingerprint  SHA-256 canonical request digest
status               processing or completed
response_status      HTTP/domain status
response_body       serialized terminal result
provider_reference   stable external operation reference
created_at           creation timestamp
completed_at         terminal timestamp
```

Create a unique index on the three scope columns. On receipt, insert a
`processing` row with the fingerprint. A duplicate insert should read the
existing row, compare fingerprints, and either wait for completion or return
the completed response. A changed fingerprint is always a conflict, even if
the first operation failed.

The business mutation and its terminal record must commit atomically when the
provider is local to the database. For an external provider, use an outbox or
provider idempotency key and a reconciliation worker. A transaction that only
writes the local record cannot undo a provider-side mint after a process crash.

## Compatibility and versioning

Clients that previously used `retirementId` may continue to do so for
retirement. New clients should send `Idempotency-Key` consistently across all
mutation endpoints. The key is opaque to the server; clients should not embed
secrets or personally identifying data in it.

The response schema does not need a new wrapper for a retry: returning the
original JSON shape keeps clients compatible. The service may add an internal
`Idempotent-Replay: true` header later if operators need to distinguish a
replayed response, but that header must not change the business result.

## Client guidance

Generate a key when the user commits one logical action, not on every network
attempt. Persist it with the client request until a terminal response arrives.
Use a new key only for a deliberately new action. If the client receives a
timeout, retry with the same key and byte-equivalent payload after a bounded
delay. If the server returns `IDEMPOTENCY_CONFLICT`, stop retrying and surface
the conflict for reconciliation; do not guess which payload was intended.

For batch operations, use one key per logical batch command unless the API
explicitly defines an atomic collection command. Combining unrelated commands
under one key makes conflict diagnosis ambiguous and increases the chance of
accidentally replaying the wrong side effect.
