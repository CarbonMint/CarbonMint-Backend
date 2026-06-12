'use strict';

/**
 * Domain constants shared across the application.
 */
const PROJECT_TYPES = [
  'reforestation',
  'renewable-energy',
  'energy-efficiency',
  'blue-carbon',
  'direct-air-capture',
];

const BATCH_STATUS = {
  ACTIVE: 'active',
  SOLD_OUT: 'sold-out',
  RETIRED: 'retired',
};

// Recognized carbon-credit registries / standards that back a project.
const REGISTRY_STANDARDS = [
  'Verra',
  'Gold Standard',
  'American Carbon Registry',
  'Climate Action Reserve',
  'Puro.earth',
];

// Plausible vintage year bounds for a credit batch. A vintage is the calendar
// year in which the emission reduction occurred.
const MIN_VINTAGE = 2000;
const MAX_VINTAGE = 2100;

// One carbon credit represents one tonne of CO2 equivalent.
const TONNES_CO2E_PER_CREDIT = 1;

const CURRENCY = 'USDC';

// Upper bound on credits moved in a single mint/buy/retire request. Guards
// against fat-finger inputs and absurd numbers overflowing the in-memory math.
const MAX_BATCH_QUANTITY = 1_000_000;

// Highest price (in USDC) a single credit may be listed at.
const MAX_PRICE_PER_CREDIT = 1_000_000;

module.exports = {
  PROJECT_TYPES,
  BATCH_STATUS,
  REGISTRY_STANDARDS,
  MIN_VINTAGE,
  MAX_VINTAGE,
  TONNES_CO2E_PER_CREDIT,
  CURRENCY,
  MAX_BATCH_QUANTITY,
  MAX_PRICE_PER_CREDIT,
};
