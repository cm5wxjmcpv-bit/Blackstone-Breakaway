import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { normalizeIncrementalConfig } from '../src/incrementalContent.js';

const manifest = JSON.parse(await readFile(new URL('../games/miner-incremental/game.json', import.meta.url)));
const payload = JSON.parse(await readFile(new URL('../games/miner-incremental/data/incremental.json', import.meta.url)));
const cinematicArt = JSON.parse(await readFile(new URL(
  '../games/miner-incremental/data/cinematic-art-manifest.json',
  import.meta.url,
)));

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
assert.deepEqual(config.employment.ranks.map((rank) => rank.id), [
  'new-hire', 'mine-worker', 'senior-miner', 'shift-lead',
]);
assert.deepEqual(config.employment.ranks.map((rank) => rank.wageShare), [0.08, 0.08, 0.09, 0.1]);
assert.deepEqual(config.employment.assignments.map((assignment) => assignment.id), [
  'shaft-7-entry',
  'shaft-7-lower',
  'blackstone-east-vein',
  'blackstone-production-heading',
]);
assert.equal(config.employment.contractDiscoveryRankId, 'shift-lead');
assert.equal(config.employment.contractBuyoutCost, 5000);
assert.equal(config.employment.scenes.length, 6);
assert.equal(config.employment.scenesById['shift-lead-contract'].completionAction, 'discover-contract');
assert.equal(config.employment.scenesById['the-walkout'].completionAction, 'complete-walkout');
assert.equal(config.employment.assignmentsById['blackstone-production-heading'].coworkers.length, 3);
assert.equal(cinematicArt.finalArtworkIntegrated, false);
assert.equal(cinematicArt.scenes.length, config.employment.scenes.length);
assert.equal(cinematicArt.scenes[0].sceneId, 'first-shift');
assert.equal(cinematicArt.scenes[0].status, 'ready-for-visual-approval');
assert.deepEqual(
  cinematicArt.scenes.map((scene) => [scene.sceneId, scene.artId]),
  config.employment.scenes.map((scene) => [scene.id, scene.artId]),
);
assert.deepEqual(new Set(config.generators.map((generator) => generator.visualType)), new Set(['miner', 'crew', 'drill']));
assert.equal(config.competition.milestones.length, 5);
assert.equal(config.competition.acquisition.productionMultiplier, 2.5);
assert.equal(config.competition.acquisition.requirements.ownedMines, 10);
assert.ok(config.lottery.scratchTickets.every((ticket) => ticket.expectedPayout < ticket.cost));

for (const forbiddenPath of ['../builder', '../supabase', '../data', '../games/catalog.json']) {
  await assert.rejects(access(new URL(forbiddenPath, import.meta.url)));
}

console.log(`Standalone contract passed: ${config.resources.length} resources, ${config.deposits.length} deposits, ${config.mines.length} mines, ${config.equipment.items.length} store items, ${config.lottery.scratchTickets.length} lottery tiers, ${config.skillBranches.length} skill branches, ${config.employment.ranks.length} Blackstone ranks, and ${config.employment.scenes.length} Chapter 1 scenes.`);
