'use strict';

/**
 * Security headers middleware. Sets a small set of conservative response
 * headers without pulling in a dependency. These are safe defaults for a JSON
 * API: it serves no HTML, so a strict CSP and nosniff are appropriate.
 */
function securityHeaders(_req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  // The API does not expose a server banner; remove Express's default.
  res.removeHeader('X-Powered-By');
  next();
}

module.exports = securityHeaders;
