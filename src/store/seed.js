'use strict';

const { store } = require('./index');
const logger = require('../utils/logger');
const holdingsService = require('../services/holdingsService');

/**
 * Seed the in-memory store with a small set of demo projects, batches, and
 * users so the API returns meaningful data immediately on boot.
 */

// ---------------------------------------------------------------------------
// Demo users – used by the RBAC authenticate middleware to validate
// X-User-Id / X-User-Role header pairs.
// ---------------------------------------------------------------------------
const SEED_USERS = [
  { id: 'admin_platform', role: 'admin' },
  { id: 'issuer_amazon', role: 'issuer' },
  { id: 'issuer_solar', role: 'issuer' },
  { id: 'issuer_kenya', role: 'issuer' },
  { id: 'issuer_mangrove', role: 'issuer' },
  { id: 'issuer_dac', role: 'issuer' },
  { id: 'buyer_alice', role: 'buyer' },
  { id: 'buyer_bob', role: 'buyer' },
];

const SEED_PROJECTS = [
  {
    id: 'proj_amazon',
    name: 'Amazon Reforestation Initiative',
    type: 'reforestation',
    country: 'Brazil',
    registry: 'Verra',
    methodology: 'VM0007',
    description:
      'Restoration of degraded rainforest land in the Brazilian Amazon basin.',
  },
  {
    id: 'proj_solar_in',
    name: 'Rajasthan Solar Grid',
    type: 'renewable-energy',
    country: 'India',
    registry: 'Gold Standard',
    methodology: 'GS-RE',
    description: 'Utility-scale solar farm displacing coal-fired generation.',
  },
  {
    id: 'proj_kenya_cook',
    name: 'Kenya Clean Cookstoves',
    type: 'energy-efficiency',
    country: 'Kenya',
    registry: 'Gold Standard',
    methodology: 'GS-TPDDTEC',
    description:
      'Distribution of efficient cookstoves reducing firewood demand and emissions.',
  },
  {
    id: 'proj_mangrove_id',
    name: 'Indonesia Mangrove Blue Carbon',
    type: 'blue-carbon',
    country: 'Indonesia',
    registry: 'Verra',
    methodology: 'VM0033',
    description:
      'Restoration and protection of coastal mangrove ecosystems sequestering blue carbon.',
  },
  {
    id: 'proj_dac_is',
    name: 'Iceland Direct Air Capture',
    type: 'direct-air-capture',
    country: 'Iceland',
    registry: 'Puro.earth',
    methodology: 'Puro-DAC',
    description:
      'Geologic mineralization of CO2 captured directly from ambient air using geothermal power.',
  },
];

const SEED_BATCHES = [
  {
    id: 'batch_seed_amazon_2022',
    projectId: 'proj_amazon',
    quantity: 10000,
    vintage: 2022,
    owner: 'issuer_amazon',
    pricePerCredit: 12.5,
  },
  {
    id: 'batch_seed_solar_2023',
    projectId: 'proj_solar_in',
    quantity: 25000,
    vintage: 2023,
    owner: 'issuer_solar',
    pricePerCredit: 8.75,
  },
  {
    id: 'batch_seed_kenya_2023',
    projectId: 'proj_kenya_cook',
    quantity: 5000,
    vintage: 2023,
    owner: 'issuer_kenya',
    pricePerCredit: 15.0,
  },
  {
    id: 'batch_seed_mangrove_2022',
    projectId: 'proj_mangrove_id',
    quantity: 8000,
    vintage: 2022,
    owner: 'issuer_mangrove',
    pricePerCredit: 18.25,
  },
  {
    id: 'batch_seed_dac_2024',
    projectId: 'proj_dac_is',
    quantity: 1500,
    vintage: 2024,
    owner: 'issuer_dac',
    pricePerCredit: 320.0,
  },
];

function seed() {
  for (const user of SEED_USERS) {
    store.users.set(user.id, { ...user });
  }

  for (const project of SEED_PROJECTS) {
    store.projects.set(project.id, { ...project, createdAt: new Date().toISOString() });
  }

  for (const b of SEED_BATCHES) {
    const project = store.projects.get(b.projectId);
    const batch = {
      id: b.id,
      projectId: b.projectId,
      projectName: project ? project.name : 'Unknown',
      quantity: b.quantity,
      available: b.quantity,
      retired: 0,
      vintage: b.vintage,
      owner: b.owner,
      pricePerCredit: b.pricePerCredit,
      forSale: true,
      status: 'active',
      txHash: `stellar_tx_seed_${b.id}`,
      createdAt: new Date().toISOString(),
    };
    store.batches.set(batch.id, batch);
    holdingsService.credit(batch.owner, batch.id, batch.quantity);
  }

  logger.info(
    `Seeded ${store.users.size} users, ${store.projects.size} projects and ${store.batches.size} batches`
  );
}

module.exports = { seed, SEED_USERS, SEED_PROJECTS, SEED_BATCHES };
