'use strict';

/**
 * RBAC tests for Issue #50.
 *
 * Covers the authenticate middleware, requireRole middleware factory, and the
 * roles configuration.  Tests run against the in-memory store so they are
 * self-contained and require no HTTP server.
 *
 * Test groups:
 *   1. roles config
 *   2. authenticate middleware
 *   3. requireRole middleware
 *   4. edge cases / integration scenarios
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// ---------------------------------------------------------------------------
// Helpers – keep store isolated between tests
// ---------------------------------------------------------------------------

const { store, reset } = require('../src/store');
const { ROLES, MINT_ROLES, TRADE_ROLES, ANY_ROLE } = require('../src/config/roles');
const authenticate = require('../src/middleware/authenticate');
const requireRole = require('../src/middleware/requireRole');

/** Build a minimal Express-like req object with optional headers and user. */
function makeReq({ userId, userRole, user } = {}) {
  const headers = {};
  if (userId !== undefined) headers['x-user-id'] = userId;
  if (userRole !== undefined) headers['x-user-role'] = userRole;
  return {
    get: (name) => headers[name.toLowerCase()] || '',
    user,
  };
}

/** Build a no-op res object. */
function makeRes() {
  return {};
}

/** Collect the argument passed to next(). Returns undefined when next() was
 *  called with no argument (i.e. the middleware succeeded). */
function captureNext() {
  let called = false;
  let arg;
  function next(err) {
    called = true;
    arg = err;
  }
  next.wasCalled = () => called;
  next.arg = () => arg;
  return next;
}

/** Seed a single user into the store. */
function seedUser(id, role) {
  store.users.set(id, { id, role });
}

// ---------------------------------------------------------------------------
// 1. Roles configuration
// ---------------------------------------------------------------------------

test('ROLES exports admin, issuer, and buyer', () => {
  assert.equal(ROLES.ADMIN, 'admin');
  assert.equal(ROLES.ISSUER, 'issuer');
  assert.equal(ROLES.BUYER, 'buyer');
});

test('MINT_ROLES includes admin and issuer but not buyer', () => {
  assert.ok(MINT_ROLES.includes('admin'));
  assert.ok(MINT_ROLES.includes('issuer'));
  assert.ok(!MINT_ROLES.includes('buyer'));
});

test('TRADE_ROLES includes admin, issuer, and buyer', () => {
  assert.ok(TRADE_ROLES.includes('admin'));
  assert.ok(TRADE_ROLES.includes('issuer'));
  assert.ok(TRADE_ROLES.includes('buyer'));
});

test('ANY_ROLE contains exactly the three known roles', () => {
  assert.equal(ANY_ROLE.length, 3);
  assert.ok(ANY_ROLE.includes('admin'));
  assert.ok(ANY_ROLE.includes('issuer'));
  assert.ok(ANY_ROLE.includes('buyer'));
});

// ---------------------------------------------------------------------------
// 2. authenticate middleware
// ---------------------------------------------------------------------------

test('authenticate: passes when headers match a seeded user', () => {
  reset();
  seedUser('u_issuer', 'issuer');

  const req = makeReq({ userId: 'u_issuer', userRole: 'issuer' });
  const next = captureNext();
  authenticate(req, makeRes(), next);

  assert.ok(next.wasCalled());
  assert.equal(next.arg(), undefined, 'next should be called without an error');
  assert.deepEqual(req.user, { id: 'u_issuer', role: 'issuer' });
});

test('authenticate: 401 when X-User-Id header is missing', () => {
  reset();

  const req = makeReq({ userRole: 'buyer' });
  const next = captureNext();
  authenticate(req, makeRes(), next);

  assert.ok(next.wasCalled());
  assert.equal(next.arg().statusCode, 401);
});

test('authenticate: 401 when X-User-Role header is missing', () => {
  reset();

  const req = makeReq({ userId: 'u_admin' });
  const next = captureNext();
  authenticate(req, makeRes(), next);

  assert.ok(next.wasCalled());
  assert.equal(next.arg().statusCode, 401);
});

test('authenticate: 401 when both headers are missing', () => {
  reset();

  const req = makeReq();
  const next = captureNext();
  authenticate(req, makeRes(), next);

  assert.ok(next.wasCalled());
  assert.equal(next.arg().statusCode, 401);
});

test('authenticate: 401 when X-User-Id is whitespace only', () => {
  reset();

  const req = makeReq({ userId: '   ', userRole: 'buyer' });
  const next = captureNext();
  authenticate(req, makeRes(), next);

  assert.ok(next.wasCalled());
  assert.equal(next.arg().statusCode, 401);
});

test('authenticate: 401 when X-User-Role is whitespace only', () => {
  reset();

  const req = makeReq({ userId: 'u_buyer', userRole: '  ' });
  const next = captureNext();
  authenticate(req, makeRes(), next);

  assert.ok(next.wasCalled());
  assert.equal(next.arg().statusCode, 401);
});

test('authenticate: 401 when role value is unrecognized', () => {
  reset();
  seedUser('u_unknown_role', 'superadmin');

  const req = makeReq({ userId: 'u_unknown_role', userRole: 'superadmin' });
  const next = captureNext();
  authenticate(req, makeRes(), next);

  assert.ok(next.wasCalled());
  assert.equal(next.arg().statusCode, 401);
});

test('authenticate: 401 when user id does not exist in store', () => {
  reset();
  // Store is empty; no users seeded

  const req = makeReq({ userId: 'ghost_user', userRole: 'buyer' });
  const next = captureNext();
  authenticate(req, makeRes(), next);

  assert.ok(next.wasCalled());
  assert.equal(next.arg().statusCode, 401);
});

test('authenticate: 401 when header role does not match stored role (privilege escalation attempt)', () => {
  reset();
  seedUser('u_buyer_only', 'buyer');

  // Attacker sends buyer id but claims issuer role
  const req = makeReq({ userId: 'u_buyer_only', userRole: 'issuer' });
  const next = captureNext();
  authenticate(req, makeRes(), next);

  assert.ok(next.wasCalled());
  assert.equal(next.arg().statusCode, 401);
});

test('authenticate: req.user is not set on failure', () => {
  reset();

  const req = makeReq({ userId: 'nobody', userRole: 'admin' });
  const next = captureNext();
  authenticate(req, makeRes(), next);

  assert.equal(req.user, undefined);
});

test('authenticate: error code is UNAUTHORIZED', () => {
  reset();

  const req = makeReq();
  const next = captureNext();
  authenticate(req, makeRes(), next);

  assert.equal(next.arg().code, 'UNAUTHORIZED');
});

test('authenticate: trims leading/trailing whitespace from header values', () => {
  reset();
  seedUser('u_admin', 'admin');

  const req = makeReq({ userId: '  u_admin  ', userRole: '  admin  ' });
  const next = captureNext();
  authenticate(req, makeRes(), next);

  assert.ok(next.wasCalled());
  assert.equal(next.arg(), undefined, 'trimmed headers should pass');
  assert.deepEqual(req.user, { id: 'u_admin', role: 'admin' });
});

test('authenticate: admin user passes with correct headers', () => {
  reset();
  seedUser('admin_platform', 'admin');

  const req = makeReq({ userId: 'admin_platform', userRole: 'admin' });
  const next = captureNext();
  authenticate(req, makeRes(), next);

  assert.equal(next.arg(), undefined);
  assert.equal(req.user.role, 'admin');
});

test('authenticate: buyer user passes with correct headers', () => {
  reset();
  seedUser('buyer_alice', 'buyer');

  const req = makeReq({ userId: 'buyer_alice', userRole: 'buyer' });
  const next = captureNext();
  authenticate(req, makeRes(), next);

  assert.equal(next.arg(), undefined);
  assert.equal(req.user.role, 'buyer');
});

// ---------------------------------------------------------------------------
// 3. requireRole middleware
// ---------------------------------------------------------------------------

test('requireRole: passes when user role is in allowed list', () => {
  const req = makeReq({ user: { id: 'u', role: 'issuer' } });
  req.user = { id: 'u', role: 'issuer' };
  const next = captureNext();
  requireRole('admin', 'issuer')(req, makeRes(), next);

  assert.equal(next.arg(), undefined);
});

test('requireRole: 403 when user role is not in allowed list', () => {
  const req = { user: { id: 'u', role: 'buyer' } };
  const next = captureNext();
  requireRole('admin', 'issuer')(req, makeRes(), next);

  assert.equal(next.arg().statusCode, 403);
});

test('requireRole: 403 error code is FORBIDDEN', () => {
  const req = { user: { id: 'u', role: 'buyer' } };
  const next = captureNext();
  requireRole('issuer')(req, makeRes(), next);

  assert.equal(next.arg().code, 'FORBIDDEN');
});

test('requireRole: 401 when req.user is absent (authenticate not applied)', () => {
  const req = {};
  const next = captureNext();
  requireRole('admin')(req, makeRes(), next);

  assert.equal(next.arg().statusCode, 401);
});

test('requireRole: admin passes MINT_ROLES check', () => {
  const req = { user: { id: 'a', role: 'admin' } };
  const next = captureNext();
  requireRole(...MINT_ROLES)(req, makeRes(), next);

  assert.equal(next.arg(), undefined);
});

test('requireRole: issuer passes MINT_ROLES check', () => {
  const req = { user: { id: 'i', role: 'issuer' } };
  const next = captureNext();
  requireRole(...MINT_ROLES)(req, makeRes(), next);

  assert.equal(next.arg(), undefined);
});

test('requireRole: buyer is denied MINT_ROLES (cannot mint batches)', () => {
  const req = { user: { id: 'b', role: 'buyer' } };
  const next = captureNext();
  requireRole(...MINT_ROLES)(req, makeRes(), next);

  assert.equal(next.arg().statusCode, 403);
});

test('requireRole: buyer passes TRADE_ROLES check', () => {
  const req = { user: { id: 'b', role: 'buyer' } };
  const next = captureNext();
  requireRole(...TRADE_ROLES)(req, makeRes(), next);

  assert.equal(next.arg(), undefined);
});

test('requireRole: admin passes TRADE_ROLES check', () => {
  const req = { user: { id: 'a', role: 'admin' } };
  const next = captureNext();
  requireRole(...TRADE_ROLES)(req, makeRes(), next);

  assert.equal(next.arg(), undefined);
});

test('requireRole: issuer passes TRADE_ROLES check', () => {
  const req = { user: { id: 'i', role: 'issuer' } };
  const next = captureNext();
  requireRole(...TRADE_ROLES)(req, makeRes(), next);

  assert.equal(next.arg(), undefined);
});

test('requireRole: single-role restriction is enforced', () => {
  const req = { user: { id: 'a', role: 'admin' } };
  const nextOk = captureNext();
  requireRole('admin')(req, makeRes(), nextOk);
  assert.equal(nextOk.arg(), undefined);

  const reqBad = { user: { id: 'i', role: 'issuer' } };
  const nextBad = captureNext();
  requireRole('admin')(reqBad, makeRes(), nextBad);
  assert.equal(nextBad.arg().statusCode, 403);
});

test('requireRole: throws when called with zero roles', () => {
  assert.throws(() => requireRole(), {
    message: /at least one role/,
  });
});

test('requireRole: ANY_ROLE permits all known roles', () => {
  for (const role of ANY_ROLE) {
    const req = { user: { id: 'u', role } };
    const next = captureNext();
    requireRole(...ANY_ROLE)(req, makeRes(), next);
    assert.equal(next.arg(), undefined, `role ${role} should pass ANY_ROLE`);
  }
});

// ---------------------------------------------------------------------------
// 4. Edge cases and integration scenarios
// ---------------------------------------------------------------------------

test('authenticate + requireRole pipeline: authorized user passes both', () => {
  reset();
  seedUser('issuer_amazon', 'issuer');

  const req = makeReq({ userId: 'issuer_amazon', userRole: 'issuer' });

  // Step 1: authenticate
  const nextAuth = captureNext();
  authenticate(req, makeRes(), nextAuth);
  assert.equal(nextAuth.arg(), undefined, 'authenticate should pass');

  // Step 2: requireRole (MINT_ROLES)
  const nextRole = captureNext();
  requireRole(...MINT_ROLES)(req, makeRes(), nextRole);
  assert.equal(nextRole.arg(), undefined, 'requireRole should pass for issuer');
});

test('authenticate + requireRole pipeline: buyer blocked at requireRole for MINT_ROLES', () => {
  reset();
  seedUser('buyer_alice', 'buyer');

  const req = makeReq({ userId: 'buyer_alice', userRole: 'buyer' });

  // authenticate succeeds
  const nextAuth = captureNext();
  authenticate(req, makeRes(), nextAuth);
  assert.equal(nextAuth.arg(), undefined);

  // requireRole blocks
  const nextRole = captureNext();
  requireRole(...MINT_ROLES)(req, makeRes(), nextRole);
  assert.equal(nextRole.arg().statusCode, 403);
});

test('authenticate + requireRole pipeline: unauthenticated request blocked at authenticate', () => {
  reset();

  const req = makeReq(); // no headers

  const nextAuth = captureNext();
  authenticate(req, makeRes(), nextAuth);
  assert.equal(nextAuth.arg().statusCode, 401);
  assert.equal(req.user, undefined);
});

test('authenticate + requireRole pipeline: privilege escalation attempt blocked', () => {
  reset();
  seedUser('buyer_bob', 'buyer');

  // Bob claims to be an issuer in the header
  const req = makeReq({ userId: 'buyer_bob', userRole: 'issuer' });

  const nextAuth = captureNext();
  authenticate(req, makeRes(), nextAuth);
  // Must fail at authentication (role mismatch) – never reaches requireRole
  assert.equal(nextAuth.arg().statusCode, 401);
});

test('multiple users: each gets their own role, no cross-contamination', () => {
  reset();
  seedUser('admin_platform', 'admin');
  seedUser('buyer_alice', 'buyer');
  seedUser('issuer_solar', 'issuer');

  const cases = [
    { userId: 'admin_platform', userRole: 'admin', expectedRole: 'admin' },
    { userId: 'buyer_alice', userRole: 'buyer', expectedRole: 'buyer' },
    { userId: 'issuer_solar', userRole: 'issuer', expectedRole: 'issuer' },
  ];

  for (const c of cases) {
    const req = makeReq({ userId: c.userId, userRole: c.userRole });
    const next = captureNext();
    authenticate(req, makeRes(), next);
    assert.equal(next.arg(), undefined, `${c.userId} should authenticate`);
    assert.equal(req.user.role, c.expectedRole);
  }
});

test('store.reset clears users map and authenticate then rejects previously valid user', () => {
  reset();
  seedUser('issuer_amazon', 'issuer');

  // Works before reset
  const req1 = makeReq({ userId: 'issuer_amazon', userRole: 'issuer' });
  const next1 = captureNext();
  authenticate(req1, makeRes(), next1);
  assert.equal(next1.arg(), undefined);

  // Clear store
  reset();

  // Same request now fails
  const req2 = makeReq({ userId: 'issuer_amazon', userRole: 'issuer' });
  const next2 = captureNext();
  authenticate(req2, makeRes(), next2);
  assert.equal(next2.arg().statusCode, 401);
});
