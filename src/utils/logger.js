'use strict';

const config = require('../config');

/**
 * Tiny leveled logger. Avoids pulling in a heavy logging dependency while
 * still respecting LOG_LEVEL from configuration.
 */
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function shouldLog(level) {
  const current = LEVELS[config.logLevel] ?? LEVELS.info;
  return LEVELS[level] <= current;
}

function format(level, args) {
  const ts = new Date().toISOString();
  return [`[${ts}] [${level.toUpperCase()}]`, ...args];
}

const logger = {
  error: (...args) => shouldLog('error') && console.error(...format('error', args)),
  warn: (...args) => shouldLog('warn') && console.warn(...format('warn', args)),
  info: (...args) => shouldLog('info') && console.log(...format('info', args)),
  debug: (...args) => shouldLog('debug') && console.log(...format('debug', args)),
};

module.exports = logger;
