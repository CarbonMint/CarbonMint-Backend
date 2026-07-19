'use strict';

/**
 * Role definitions for CarbonMint RBAC.
 *
 * Three roles cover the domain:
 *   - admin   : Platform operator. Can perform any action including minting.
 *   - issuer  : Verified project owner. Can mint credit batches and trade.
 *   - buyer   : Regular marketplace participant. Can buy and retire credits.
 *
 * When adding a new role:
 *   1. Add it to ROLES below.
 *   2. Update ROLE_PERMISSIONS to list every route group it may access.
 *   3. Seed at least one user with the new role in src/store/seed.js.
 *   4. Document the role in README.md under the RBAC section.
 */
const ROLES = {
  ADMIN: 'admin',
  ISSUER: 'issuer',
  BUYER: 'buyer',
};

/**
 * Permission sets reused across route files.
 *
 * MINT_ROLES  – roles allowed to create (mint) a new credit batch.
 * TRADE_ROLES – roles allowed to buy or retire credits.
 * ANY_ROLE    – all known roles (shorthand for "any authenticated user").
 */
const MINT_ROLES = [ROLES.ADMIN, ROLES.ISSUER];
const TRADE_ROLES = [ROLES.ADMIN, ROLES.ISSUER, ROLES.BUYER];
const ANY_ROLE = Object.values(ROLES);

module.exports = { ROLES, MINT_ROLES, TRADE_ROLES, ANY_ROLE };
