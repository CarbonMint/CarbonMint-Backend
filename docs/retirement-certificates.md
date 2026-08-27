# Retirement certificate integrity

Retirement certificates are public evidence that credits were permanently
retired. The backend stores them in memory today, but it treats the certificate
shape as a durable protocol so a later database adapter can preserve the same
verification guarantees.

## Immutable certificate facts

Each certificate includes:

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Canonical payload version (`1` for the current format) |
| `id` | Unique certificate identifier |
| `batchId` | Retired credit batch |
| `projectId`, `projectName` | Backing project identity at retirement time |
| `vintage` | Credit vintage |
| `quantity` | Number of credits retired |
| `retiredBy` | Account whose holdings were burned |
| `beneficiary` | Public claimant, defaulting to `retiredBy` |
| `reason` | Public retirement reason |
| `txHash` | Simulated/on-chain burn transaction reference |
| `retiredAt` | ISO-8601 retirement timestamp |
| `contentHash` | SHA-256 digest of the canonical immutable payload |
| `corrections` | Append-only, hash-chained correction events |

The hash covers the immutable fields in a fixed order. It does not cover
object insertion order, internal request indexes, or the correction array;
corrections have their own chained hashes. This lets consumers distinguish a
fact that was changed from a permitted presentation correction.

The canonical payload is equivalent to:

```json
{
  "schemaVersion": 1,
  "id": "cert_example",
  "batchId": "batch_example",
  "projectId": "project_example",
  "projectName": "Example Forest",
  "vintage": 2024,
  "quantity": 100,
  "retiredBy": "buyer_alice",
  "beneficiary": "Example Foundation",
  "reason": "Verified restoration claim",
  "txHash": "stellar_tx_example",
  "retiredAt": "2026-08-27T00:00:00.000Z"
}
```

`contentHash` is `sha256:` followed by the lowercase hexadecimal SHA-256
digest of that exact JSON representation. A verifier can recompute it from
the returned fields and reject the record when it differs.

## Idempotent retirement

Clients may send an optional `retirementId` on `POST /api/retire`. Repeating a
request with that value returns the existing certificate and does not burn the
holdings a second time. Reusing the same `retirementId` with different
retirement facts is a conflict.

For compatibility with older clients, requests without `retirementId` use a
canonical digest of `batchId`, authenticated user, quantity, effective
beneficiary, and effective reason. An identical retry therefore remains
idempotent, while a different request receives a new certificate. New clients
should always provide a stable idempotency value generated before submitting
the burn transaction.

The request user must equal the authenticated `X-User-Id`; a body user cannot
be used to retire another account's holdings. This check is performed at the
HTTP boundary in addition to the holdings balance check in the service.

## Retrieval and ownership

`GET /api/certificates/:id` always verifies the content hash and every
correction hash before returning a certificate. A corrupted record returns
HTTP `409` with code `CERTIFICATE_INTEGRITY_FAILURE` rather than being served
as trustworthy evidence.

The endpoint remains publicly readable for third-party verification. A caller
that knows the expected owner can add `?user=<id>`; a mismatch returns HTTP
`403`. List filtering by `user` and `projectId` uses the same integrity
verification path for every returned certificate.

## Append-only corrections

There is no general certificate update operation. An administrator can submit
an allowed presentation correction through:

```text
PATCH /api/certificates/:id
X-User-Id: admin_platform
X-User-Role: admin
```

The body must include `correctionReason` and may change only `beneficiary` or
`reason`. The original fields and `contentHash` remain unchanged. Each event
records:

- the certificate and correction identifiers;
- the authenticated administrator;
- the changed fields;
- a required human-readable reason;
- the correction timestamp;
- the previous chain hash; and
- its own SHA-256 hash.

Retrieval exposes the immutable values, the full correction history, and a
verified `current` projection. Deleting, reordering, editing, or inserting a
correction without recomputing the chain is detected.

## Compatibility notes

- Existing certificate fields remain present and retain their original
  meanings.
- `schemaVersion`, `contentHash`, `requestDigest`, and `corrections` are
  additive metadata.
- Public reads remain unauthenticated unless the optional ownership check is
  requested.
- Corrections are restricted to administrators and do not rewrite retirement
  accounting, holdings, batch supply, or the original burn transaction.
- The hash schema is versioned. A future schema must be introduced explicitly
  rather than silently changing the meaning of existing certificates.
