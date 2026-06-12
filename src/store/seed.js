'use strict';

const { store } = require('./index');
const logger = require('../utils/logger');
const holdingsService = require('../services/holdingsService');

/**
 * Seed the in-memory store with a small set of demo projects and batches so
 * the API returns meaningful data immediately on boot.
 */
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
];

function seed() {
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
    `Seeded ${store.projects.size} projects and ${store.batches.size} batches`
  );
}

module.exports = { seed, SEED_PROJECTS, SEED_BATCHES };
