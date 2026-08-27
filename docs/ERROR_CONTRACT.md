# CarbonMint API error contract

CarbonMint responses use a versioned machine-readable error envelope. Clients
must branch on `error.code` and `error.retryable`, not on human-readable text.

## Envelope

```json
{
  "error": {
    "version": "v1",
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "status": 400,
    "retryable": false,
    "correlationId": "req_123",
    "details": {
      "fields": ["quantity: must be an integer"]
    }
  }
}
```

The fields have these meanings:

| Field | Contract | Meaning |
| --- | --- | --- |
| `version` | non-empty string | Public schema version. |
| `code` | stable uppercase string | Client action and telemetry key. |
| `message` | safe string | Human-facing summary with no provider secrets. |
| `status` | HTTP status | Transport status for the response. |
| `retryable` | boolean | Whether a bounded retry may succeed. |
| `correlationId` | string or null | Request ID for support and tracing. |
| `details` | object or null | Bounded, non-sensitive structured context. |

## Code families

| Code | Status | Retry | Client behavior |
| --- | --- | --- | --- |
| `BAD_REQUEST` | 400 | no | Fix the submitted request. |
| `UNAUTHORIZED` | 401 | no | Obtain valid authentication. |
| `FORBIDDEN` | 403 | no | Request an allowed role. |
| `NOT_FOUND` | 404 | no | Refresh resource state or stop. |
| `CONFLICT` | 409 | no | Reconcile current state before retrying. |
| `UNPROCESSABLE_ENTITY` | 422 | no | Fix domain validation errors. |
| `PAYLOAD_TOO_LARGE` | 413 | no | Reduce the request body. |
| `TOO_MANY_REQUESTS` | 429 | yes | Honor backoff and retry later. |
| `SERVICE_UNAVAILABLE` | 503 | yes | Retry with bounded backoff. |
| `PROVIDER_*` | 429/503 | yes | Retry only under the provider policy. |
| `INTERNAL_ERROR` | 500 | yes | Retry carefully and report the correlation ID. |

Provider-specific codes are namespaced so an upstream vocabulary cannot collide
with an application error. Known transport codes include:

- `PROVIDER_ETIMEDOUT`
- `PROVIDER_ECONNRESET`
- `PROVIDER_ECONNREFUSED`
- `PROVIDER_UNAVAILABLE`
- `PROVIDER_RATE_LIMITED`

Unknown provider codes normalize to `PROVIDER_UNAVAILABLE`. The raw provider
message is never returned because it may contain credentials, network details,
or implementation-specific information.

## Validation details

Validation middleware returns bounded field messages under `details.fields`.
Each field message is limited to 256 characters and a response contains at most
50 messages. A client may display these messages, but should still key form
logic from the field prefix and its own schema.

The following examples are stable:

```json
{
  "error": {
    "version": "v1",
    "code": "BAD_REQUEST",
    "message": "Validation failed",
    "status": 400,
    "retryable": false,
    "correlationId": "req-1",
    "details": {
      "fields": [
        "projectId is required",
        "quantity: must be an integer"
      ]
    }
  }
}
```

## Retry guidance

Only retry a request when `retryable` is true. Use exponential backoff with
jitter and cap the number of attempts. A client must retain the same request
correlation or idempotency context when the endpoint supports it, and must not
blindly repeat a non-idempotent operation after an ambiguous provider timeout.

The API marks 429 and provider transport failures as retryable. It marks input,
authorization, not-found, conflict, and unsupported-operation errors as
non-retryable. This distinction lets worker queues avoid turning permanent
validation failures into retry storms.

## Correlation and support

Every request receives an `X-Request-Id` response header. The same value is
returned as `error.correlationId`. Clients should include it in support tickets,
logs, and downstream trace attributes. The service does not accept arbitrary
correlation data from an error body; it uses the request middleware value.

## Redaction

Error details retain safe primitive values such as field names, bounded numeric
limits, and booleans. Values under keys matching `secret`, `token`, `password`,
`credential`, `privateKey`, or `mnemonic` are replaced with `[REDACTED]`.
Nested objects that are not part of the explicitly supported contract are
redacted rather than recursively exposed. This is deliberate: callers get
debuggable validation data without a provider payload becoming an API leak.

## Compatibility and rollout

The `version` field makes future envelope changes explicit. Additive fields may
be introduced within `v1`; changing the meaning of an existing field requires
`v2`. Consumers should ignore unknown fields and treat an unknown version as a
safe generic error while preserving the HTTP status.

Existing callers that read `error.code`, `error.status`, or `error.details`
continue to receive those concepts. Callers should migrate to `version`,
`retryable`, and `correlationId` for robust behavior.

## Testing requirements

The contract test suite covers status-to-retry mapping, provider normalization,
credential redaction, detail bounds, correlation propagation, and internal
failure hiding. Any new code must add a test for a new public code or a new
provider mapping before changing this document.

## Consumer checklist

Before shipping an integration, verify that it:

1. Reads `error.code` instead of matching `error.message`.
2. Handles a missing or unknown contract version safely.
3. Preserves `error.correlationId` in logs.
4. Retries only when `error.retryable` is true.
5. Applies jitter and a maximum retry count.
6. Displays `details.fields` as validation feedback when present.
7. Does not render provider details as trusted HTML.
8. Treats a 409 as a state reconciliation signal.
9. Does not repeat an ambiguous non-idempotent operation blindly.
10. Ignores additive fields introduced within `v1`.

These rules are intentionally short and apply equally to web clients, worker
consumers, CLI tools, and integration tests.

The contract is deliberately transport-neutral: the same code and retry
meaning applies when an error is returned from REST, a queue consumer, or a
future command-line adapter.
