'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const createApp = require('../src/app');
const { SEED_BATCHES, seed } = require('../src/store/seed');
const { reset, store } = require('../src/store');

const OWNER = SEED_BATCHES[0].owner;
const BATCH_ID = SEED_BATCHES[0].id;

let server;
let baseUrl;

function headers(user = OWNER, role = 'issuer') {
  return {
    'content-type': 'application/json',
    'X-User-Id': user,
    'X-User-Role': role,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  return { response, body };
}

test.beforeEach(async () => {
  reset();
  seed();
  server = createApp().listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

test.afterEach(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

function retirementBody(overrides = {}) {
  return {
    batchId: BATCH_ID,
    user: OWNER,
    quantity: 10,
    beneficiary: 'api-beneficiary',
    reason: 'API retirement',
    retirementId: 'api-retirement-001',
    ...overrides,
  };
}

test('retirement API binds the body user to the authenticated owner', async () => {
  const accepted = await request('/api/retire', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(retirementBody()),
  });
  assert.equal(accepted.response.status, 201);
  assert.equal(accepted.body.certificate.retiredBy, OWNER);

  const spoofed = await request('/api/retire', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(retirementBody({
      retirementId: 'api-retirement-spoof',
      user: 'buyer_bob',
    })),
  });
  assert.equal(spoofed.response.status, 403);
  assert.equal(spoofed.body.error.code, 'FORBIDDEN');
});

test('repeating an API request with its retirement id is idempotent', async () => {
  const first = await request('/api/retire', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(retirementBody()),
  });
  const second = await request('/api/retire', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(retirementBody()),
  });

  assert.equal(first.response.status, 201);
  assert.equal(second.response.status, 201);
  assert.equal(second.body.certificate.id, first.body.certificate.id);
  assert.equal(store.certificates.size, 1);
});

test('certificate retrieval supports public verification and optional owner checks', async () => {
  const created = await request('/api/retire', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(retirementBody()),
  });
  const id = created.body.certificate.id;

  const publicRead = await request(`/api/certificates/${id}`);
  assert.equal(publicRead.response.status, 200);
  assert.equal(publicRead.body.certificate.id, id);
  assert.equal(publicRead.body.certificate.current.reason, 'API retirement');

  const ownerRead = await request(`/api/certificates/${id}?user=${encodeURIComponent(OWNER)}`);
  assert.equal(ownerRead.response.status, 200);
  assert.equal(ownerRead.body.certificate.retiredBy, OWNER);

  const wrongOwner = await request(`/api/certificates/${id}?user=buyer_bob`);
  assert.equal(wrongOwner.response.status, 403);
  assert.equal(wrongOwner.body.error.code, 'FORBIDDEN');
});

test('admin correction API appends an auditable change', async () => {
  const created = await request('/api/retire', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(retirementBody()),
  });
  const id = created.body.certificate.id;

  const corrected = await request(`/api/certificates/${id}`, {
    method: 'PATCH',
    headers: headers('admin_platform', 'admin'),
    body: JSON.stringify({
      beneficiary: 'corrected-beneficiary',
      correctionReason: 'Registry supplied the legal beneficiary name',
    }),
  });
  assert.equal(corrected.response.status, 200);
  assert.equal(corrected.body.certificate.beneficiary, 'api-beneficiary');
  assert.equal(corrected.body.certificate.current.beneficiary, 'corrected-beneficiary');
  assert.equal(corrected.body.certificate.corrections.length, 1);
  assert.equal(corrected.body.certificate.corrections[0].actor, 'admin_platform');
});

test('non-admins cannot append certificate corrections', async () => {
  const created = await request('/api/retire', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(retirementBody()),
  });
  const id = created.body.certificate.id;

  const rejected = await request(`/api/certificates/${id}`, {
    method: 'PATCH',
    headers: headers(OWNER, 'issuer'),
    body: JSON.stringify({
      reason: 'Unauthorized correction',
      correctionReason: 'Should not be accepted',
    }),
  });
  assert.equal(rejected.response.status, 403);
  assert.equal(rejected.body.error.code, 'FORBIDDEN');
  assert.equal(store.certificates.get(id).corrections.length, 0);
});

test('correction API requires an audit reason and a correctable field', async () => {
  const created = await request('/api/retire', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(retirementBody()),
  });
  const id = created.body.certificate.id;

  const missingReason = await request(`/api/certificates/${id}`, {
    method: 'PATCH',
    headers: headers('admin_platform', 'admin'),
    body: JSON.stringify({ reason: 'Missing audit reason' }),
  });
  assert.equal(missingReason.response.status, 400);

  const missingField = await request(`/api/certificates/${id}`, {
    method: 'PATCH',
    headers: headers('admin_platform', 'admin'),
    body: JSON.stringify({ correctionReason: 'No field supplied' }),
  });
  assert.equal(missingField.response.status, 400);
  assert.equal(store.certificates.get(id).corrections.length, 0);
});

test('certificate API refuses tampered records instead of serving them', async () => {
  const created = await request('/api/retire', {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(retirementBody()),
  });
  const id = created.body.certificate.id;
  store.certificates.get(id).reason = 'tampered in memory';

  const fetched = await request(`/api/certificates/${id}`);
  assert.equal(fetched.response.status, 409);
  assert.equal(fetched.body.error.code, 'CERTIFICATE_INTEGRITY_FAILURE');
});
