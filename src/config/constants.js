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

// One carbon credit represents one tonne of CO2 equivalent.
const TONNES_CO2E_PER_CREDIT = 1;

const CURRENCY = 'USDC';

module.exports = {
  PROJECT_TYPES,
  BATCH_STATUS,
  TONNES_CO2E_PER_CREDIT,
  CURRENCY,
};
