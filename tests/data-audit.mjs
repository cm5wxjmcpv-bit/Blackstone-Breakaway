import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { normalizeIncrementalConfig } from '../src/incrementalContent.js';

const manifestUrl = new URL('../games/miner-incremental/game.json', import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl));
const payload = JSON.parse(await readFile(new URL('../games/miner-incremental/data/incremental.json', import.meta.url)));

assert.equal(manifest.id, 'miner-incremental');
assert.equal(manifest.gameType, 'incremental');
assert.equal(manifest.data.incremental, 'data/incremental.json');
const config = normalizeIncrementalConfig(payload, { gameId: manifest.id });
assert.equal(config.resources.length, 9);
assert.equal(config.deposits.length, 9);
assert.equal(config.mines.length, 10);
assert.equal(config.equipment.items.length, 23);
assert.equal(config.lottery.scratchTickets.length, 7);
assert.equal(config.skillBranches.length, 3);
assert.deepEqual(new Set(config.generators.map((generator) => generator.visualType)), new Set(['miner', 'crew', 'drill']));
assert.equal(config.competition.milestones.length, 5);
assert.equal(config.competition.acquisition.productionMultiplier, 2.5);
assert.equal(config.competition.acquisition.requirements.ownedMines, 10);
assert.ok(config.lottery.scratchTickets.every((ticket) => ticket.expectedPayout < ticket.cost));

const artAssets = new Set([
  config.ui.minerImage,
  ...config.deposits.flatMap((deposit) => deposit.visual.images),
  ...config.mines.map((mine) => mine.visual.image),
  ...config.story.milestones.map((milestone) => milestone.image),
  ...config.competition.milestones.map((milestone) => milestone.image),
  config.competition.acquisition.completion.image,
].filter(Boolean));
assert.equal(artAssets.size, 23);
await Promise.all([...artAssets].map((asset) => access(new URL(asset, manifestUrl))));

for (const forbiddenPath of ['../builder', '../supabase', '../data', '../games/catalog.json']) {
  await assert.rejects(access(new URL(forbiddenPath, import.meta.url)));
}

console.log(`Standalone contract passed: ${config.resources.length} resources, ${config.deposits.length} deposits, ${config.mines.length} mines, ${config.equipment.items.length} store items, ${config.lottery.scratchTickets.length} lottery tiers, and ${config.skillBranches.length} skill branches.`);
