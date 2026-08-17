import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { normalizeIncrementalConfig } from '../../src/incrementalContent.js';
import { IncrementalGame } from '../../src/incrementalGame.js';
import {
  createInitialIncrementalSnapshot,
  migrateIncrementalSnapshot,
  validateIncrementalSnapshot,
} from '../../src/incrementalSaveSystem.js';

const rawConfig = JSON.parse(await readFile(
  new URL('../../games/miner-incremental/data/incremental.json', import.meta.url),
));

function clone(value) {
  return structuredClone(value);
}

function config() {
  return normalizeIncrementalConfig(clone(rawConfig), { gameId: 'miner-incremental' });
}

function gameHarness(options = {}) {
  let latest = options.loaded ? clone(options.loaded) : null;
  let now = options.now || 10_000;
  const game = new IncrementalGame({
    config: options.config || config(),
    gameVersion: '0.9.0',
    random: options.random || (() => 0.5),
    clock: options.clock || (() => ++now),
    saveAdapter: {
      load: () => (latest ? clone(latest) : null),
      save: (snapshot) => {
        latest = clone(snapshot);
        return true;
      },
    },
  });
  return {
    game,
    latest: () => (latest ? clone(latest) : null),
  };
}

function completePendingScenes(game) {
  let guard = 0;
  while (game.state.employment.pendingScenes.length && guard < 20) {
    const sceneId = game.state.employment.pendingScenes[0];
    const scene = game.config.employment.scenesById[sceneId];
    const firstChoice = scene.steps.flatMap((step) => step.choices)[0];
    if (firstChoice && !game.state.employment.storyChoices[sceneId]) {
      assert.equal(game.recordEmploymentStoryChoice(sceneId, firstChoice.id).ok, true);
    }
    assert.equal(game.completeEmploymentScene(sceneId).ok, true);
    guard += 1;
  }
  assert.ok(guard < 20, 'employment scene queue should drain');
}

function mineUntil(game, predicate, limit = 20_000) {
  let swings = 0;
  while (!predicate() && swings < limit) {
    game.mine();
    swings += 1;
  }
  assert.ok(predicate(), `progression condition was not reached after ${limit} swings`);
  return swings;
}

function reachShiftLead(game) {
  completePendingScenes(game);
  const promotions = [];
  while (game.state.employment.rankId !== 'shift-lead') {
    const previousRank = game.state.employment.rankId;
    mineUntil(game, () => game.state.employment.rankId !== previousRank);
    promotions.push({
      rankId: game.state.employment.rankId,
      deposits: game.state.employment.depositsBroken,
      level: game.state.character.level,
      cash: game.state.cash,
      companyValue: game.state.employment.companyValue,
    });
    completePendingScenes(game);
  }
  return promotions;
}

test('the actual package defines four validated Blackstone ranks, assignments, scenes, and honest wage rates', () => {
  const actual = config();
  assert.deepEqual(actual.employment.ranks.map((rank) => rank.id), [
    'new-hire', 'mine-worker', 'senior-miner', 'shift-lead',
  ]);
  assert.deepEqual(actual.employment.ranks.map((rank) => rank.wageShare), [0.08, 0.08, 0.09, 0.1]);
  assert.deepEqual(actual.employment.assignments.map((assignment) => assignment.id), [
    'shaft-7-entry',
    'shaft-7-lower',
    'blackstone-east-vein',
    'blackstone-production-heading',
  ]);
  assert.equal(actual.employment.contractBuyoutCost, 5000);
  assert.equal(actual.employment.scenes.length, 6);
  assert.ok(actual.employment.scenes.every((scene) => scene.assetPath.endsWith('.webp')));
  assert.equal(actual.employment.assignmentsById['blackstone-production-heading'].coworkers.length, 3);
});

test('employment data rejects broken rank, assignment, wage, equipment, and scene references', () => {
  const missingDeposit = clone(rawConfig);
  missingDeposit.employment.assignments[0].depositIds = ['missing-deposit'];
  assert.throws(
    () => normalizeIncrementalConfig(missingDeposit, { gameId: 'miner-incremental' }),
    /references missing deposit/,
  );

  const invalidWage = clone(rawConfig);
  invalidWage.employment.ranks[1].wageShare = Number.POSITIVE_INFINITY;
  assert.throws(
    () => normalizeIncrementalConfig(invalidWage, { gameId: 'miner-incremental' }),
    /wageShare must be between 0 and 1/,
  );

  const missingTool = clone(rawConfig);
  missingTool.employment.ranks[2].companyToolId = 'missing-tool';
  assert.throws(
    () => normalizeIncrementalConfig(missingTool, { gameId: 'miner-incremental' }),
    /references missing company tool/,
  );

  const missingAssignment = clone(rawConfig);
  missingAssignment.employment.ranks[1].assignmentId = 'missing-heading';
  assert.throws(
    () => normalizeIncrementalConfig(missingAssignment, { gameId: 'miner-incremental' }),
    /references missing assignment/,
  );

  const unsafeDiscovery = clone(rawConfig);
  unsafeDiscovery.employment.scenes.find((scene) => scene.id === 'shift-lead-contract').completionAction = 'none';
  assert.throws(
    () => normalizeIncrementalConfig(unsafeDiscovery, { gameId: 'miner-incremental' }),
    /contract discovery rank scene must use the discover-contract/,
  );

  const unsafeArtwork = clone(rawConfig);
  unsafeArtwork.employment.scenes[0].assetPath = '../outside-package.png';
  assert.throws(
    () => normalizeIncrementalConfig(unsafeArtwork, { gameId: 'miner-incremental' }),
    /assetPath must be a safe relative/,
  );
});

test('a new save starts as a New Hire with a hidden contract and Blackstone-owned output', () => {
  const { game } = gameHarness();
  game.start();
  assert.equal(game.state.storyStage, 'employee');
  assert.equal(game.state.employment.rankId, 'new-hire');
  assert.equal(game.state.employment.assignmentId, 'shaft-7-entry');
  assert.equal(game.state.employment.contractDiscovered, false);
  assert.deepEqual(game.buyOutContract(), { ok: false, reason: 'contract-hidden' });
  assert.deepEqual(game.state.employment.pendingScenes, ['first-shift']);
  completePendingScenes(game);

  mineUntil(game, () => game.state.statistics.totalDepositsBroken === 1);
  assert.equal(game.state.materials.stone, 0);
  assert.equal(game.state.materials.coal, 0);
  assert.equal(game.state.employment.totalWages, game.state.cash);
  assert.ok(game.state.employment.companyValue > game.state.employment.totalWages);
});

test('promotions are deterministic, change assignments once, and completed scenes do not replay on reload', () => {
  const harness = gameHarness();
  const promotionEvents = [];
  const sceneEvents = [];
  harness.game.subscribe((event) => {
    if (event.type === 'employment-promotion') promotionEvents.push(event.detail.rankId);
    if (event.type === 'story-scene') sceneEvents.push(event.detail.scene.id);
  });
  harness.game.start();
  const promotions = reachShiftLead(harness.game);

  assert.deepEqual(promotions.map((entry) => entry.rankId), [
    'mine-worker', 'senior-miner', 'shift-lead',
  ]);
  assert.deepEqual(promotionEvents, ['mine-worker', 'senior-miner', 'shift-lead']);
  assert.deepEqual(harness.game.state.employment.completedPromotions, [
    'new-hire', 'mine-worker', 'senior-miner', 'shift-lead',
  ]);
  assert.deepEqual(harness.game.state.employment.completedScenes, [
    'first-shift', 'first-promotion', 'senior-miner', 'shift-lead-contract',
  ]);
  assert.equal(harness.game.state.employment.contractDiscovered, true);

  const reloadedScenes = [];
  const reloaded = gameHarness({ loaded: harness.latest() });
  reloaded.game.subscribe((event) => {
    if (event.type === 'story-scene') reloadedScenes.push(event.detail.scene.id);
  });
  assert.equal(reloaded.game.start().source, 'save');
  assert.deepEqual(reloadedScenes, []);
  assert.equal(reloaded.game.state.employment.rankId, 'shift-lead');
  assert.equal(reloaded.game.state.employment.pendingScenes.length, 0);
});

test('every employee rank pays only its configured wage while Blackstone keeps the ore and larger value', () => {
  const actual = config();
  for (const rank of actual.employment.ranks) {
    const { game } = gameHarness({ config: actual });
    game.start();
    completePendingScenes(game);
    const assignment = actual.employment.assignmentsById[rank.assignmentId];
    const deposit = actual.depositsById[assignment.depositIds[0]];
    game.state.employment.rankId = rank.id;
    game.state.employment.assignmentId = rank.assignmentId;
    game.state.character.level = rank.promotionRequirements.requiredLevel;
    game.state.currentDeposit = { id: deposit.id, hp: 1, maxHp: deposit.maxHp };
    const beforeMaterials = clone(game.state.materials);
    const result = game.mine();
    assert.equal(result.destination, 'employer');
    assert.deepEqual(game.state.materials, beforeMaterials);
    assert.equal(result.wage, Math.max(rank.minimumWage, Math.floor(result.grossValue * rank.wageShare)));
    assert.ok(result.grossValue - result.wage > result.wage);
  }
});

test('Shift Lead coworkers use separate visual faces and never change the player target or inventory', () => {
  const { game } = gameHarness();
  game.start();
  reachShiftLead(game);
  const coworkers = game.getEmploymentCoworkers();
  assert.equal(coworkers.length, 3);
  assert.ok(coworkers.every((coworker) => coworker.depositId !== ''));
  const playerTarget = clone(game.state.currentDeposit);
  const playerMaterials = clone(game.state.materials);
  const companyResources = clone(game.state.employment.companyResources);
  game.update(10);
  assert.deepEqual(game.state.currentDeposit, playerTarget);
  assert.deepEqual(game.state.materials, playerMaterials);
  assert.deepEqual(game.state.employment.companyResources, companyResources);
});

test('contract discovery happens only after the Shift Lead scene completes', () => {
  const { game } = gameHarness();
  game.start();
  completePendingScenes(game);
  while (game.state.employment.rankId !== 'shift-lead') {
    const priorRank = game.state.employment.rankId;
    mineUntil(game, () => game.state.employment.rankId !== priorRank);
    if (game.state.employment.rankId === 'shift-lead') break;
    completePendingScenes(game);
  }
  assert.equal(game.state.employment.rankId, 'shift-lead');
  assert.equal(game.state.employment.contractDiscovered, false);
  assert.deepEqual(game.buyOutContract(), { ok: false, reason: 'contract-hidden' });
  assert.deepEqual(game.state.employment.pendingScenes, ['shift-lead-contract']);
  completePendingScenes(game);
  assert.equal(game.state.employment.contractDiscovered, true);
  assert.equal(game.getContractBuyoutStatus().cost, 5000);
});

test('the Walkout reserves payment once, survives reload, and replay cannot charge or transition again', () => {
  const first = gameHarness();
  first.game.start();
  reachShiftLead(first.game);
  first.game.state.cash = 5000;
  const purchase = first.game.buyOutContract();
  assert.equal(purchase.ok, true);
  assert.equal(first.game.state.cash, 0);
  assert.equal(first.game.state.storyStage, 'employee');
  assert.equal(first.game.state.employment.buyoutTransaction.status, 'walkout-pending');
  assert.equal(first.game.buyOutContract().resumed, true);
  assert.equal(first.game.state.cash, 0);

  const resumedScenes = [];
  const resumed = gameHarness({ loaded: first.latest() });
  resumed.game.subscribe((event) => {
    if (event.type === 'story-scene') resumedScenes.push(event.detail);
  });
  assert.equal(resumed.game.start().source, 'save');
  assert.equal(resumed.game.state.cash, 0);
  assert.equal(resumedScenes[0].scene.id, 'the-walkout');
  assert.equal(resumed.game.completeEmploymentScene('the-walkout').ok, true);
  assert.equal(resumed.game.state.storyStage, 'independent');
  assert.equal(resumed.game.state.employment.active, false);
  assert.equal(resumed.game.state.employment.contractBuyoutPaid, 5000);
  assert.equal(resumed.game.state.employment.buyoutTransaction.status, 'completed');
  assert.equal(resumed.game.state.employment.pendingScenes[0], 'freedom-claim-arrival');
  assert.equal(resumed.game.completeEmploymentScene('freedom-claim-arrival').ok, true);

  const beforeReplay = clone(resumed.game.state);
  assert.equal(resumed.game.replayEmploymentScene('the-walkout').ok, true);
  assert.equal(resumedScenes.at(-1).replay, true);
  assert.deepEqual(resumed.game.state, beforeReplay);
  assert.equal(resumed.game.completeEmploymentScene('the-walkout').reason, 'already-completed');
  assert.deepEqual(resumed.game.state, beforeReplay);
});

test('v0.8 employee and independent saves reconcile without losing progress or flooding scenes', () => {
  const actual = config();
  const employedV8 = createInitialIncrementalSnapshot(actual, { now: 1_000, gameVersion: '0.8.0' });
  employedV8.saveVersion = 8;
  employedV8.character.level = 5;
  employedV8.cash = 420;
  employedV8.employment.companyValue = 2_000;
  employedV8.employment.totalWages = 420;
  employedV8.mineProgress[employedV8.currentMine].depositsBroken = 90;
  const migratedEmployee = migrateIncrementalSnapshot(employedV8);
  assert.equal(migratedEmployee.employment.legacyChapter, true);
  const employeeScenes = [];
  const employee = gameHarness({ loaded: migratedEmployee });
  employee.game.subscribe((event) => {
    if (event.type === 'story-scene') employeeScenes.push(event.detail.scene.id);
  });
  assert.equal(employee.game.start().source, 'save');
  assert.equal(employee.game.state.employment.rankId, 'senior-miner');
  assert.equal(employee.game.state.employment.assignmentId, 'blackstone-east-vein');
  assert.equal(employee.game.state.cash, 420);
  assert.equal(employee.game.state.employment.pendingScenes.length, 0);
  assert.deepEqual(employeeScenes, []);

  const independentV8 = createInitialIncrementalSnapshot(actual, { now: 2_000, gameVersion: '0.8.0' });
  independentV8.saveVersion = 8;
  independentV8.storyStage = 'independent';
  independentV8.employment.active = false;
  independentV8.employment.contractBuyoutPaid = 500;
  independentV8.employment.endedAt = 1_500;
  const independentScenes = [];
  const independent = gameHarness({ loaded: migrateIncrementalSnapshot(independentV8) });
  independent.game.subscribe((event) => {
    if (event.type === 'story-scene') independentScenes.push(event.detail.scene.id);
  });
  assert.equal(independent.game.start().source, 'save');
  assert.equal(independent.game.state.storyStage, 'independent');
  assert.equal(independent.game.state.employment.active, false);
  assert.equal(independent.game.state.employment.rankId, 'shift-lead');
  assert.equal(independent.game.state.employment.contractBuyoutPaid, 500);
  assert.equal(independent.game.state.employment.completedScenes.length, 6);
  assert.equal(independent.game.state.employment.pendingScenes.length, 0);
  assert.deepEqual(independentScenes, []);
});

test('malformed buyout transaction states fail save validation safely', () => {
  const actual = config();
  const pendingButInactive = createInitialIncrementalSnapshot(actual, { now: 1, gameVersion: '0.9.0' });
  pendingButInactive.cash = 0;
  pendingButInactive.employment.contractBuyoutPaid = 5000;
  pendingButInactive.employment.buyoutTransaction = {
    id: 'employment-contract-buyout',
    status: 'walkout-pending',
    amount: 5000,
    paidAt: 1,
    completedAt: null,
  };
  pendingButInactive.employment.active = false;
  assert.equal(validateIncrementalSnapshot(pendingButInactive), false);

  const mismatchedAmount = createInitialIncrementalSnapshot(actual, { now: 1, gameVersion: '0.9.0' });
  mismatchedAmount.employment.contractBuyoutPaid = 5000;
  mismatchedAmount.employment.buyoutTransaction = {
    id: 'employment-contract-buyout',
    status: 'walkout-pending',
    amount: 4999,
    paidAt: 1,
    completedAt: null,
  };
  assert.equal(validateIncrementalSnapshot(mismatchedAmount), false);
});

function simulateEmployment(strategy) {
  const { game } = gameHarness();
  game.start();
  completePendingScenes(game);
  const transitions = [];
  const purchased = new Set();
  let lastRank = game.state.employment.rankId;
  let swings = 0;
  let discovery = null;

  function buy(itemId) {
    if (purchased.has(itemId)) return;
    const item = game.config.equipment.itemsById[itemId];
    if (game.state.character.level >= item.requiredLevel && game.state.cash >= item.cost) {
      if (game.purchaseEquipment(itemId).ok) purchased.add(itemId);
    }
  }

  function spend() {
    if (strategy === 'save-focused' || strategy === 'efficient') {
      while (game.state.character.skillPoints > 0 && game.state.skills['mining-power'] < 10) {
        game.allocateSkill('mining-power');
      }
    } else {
      const skillOrder = ['mining-power', 'ore-yield', 'automation-bonus'];
      let attempts = 0;
      while (game.state.character.skillPoints > 0 && attempts < 20) {
        const skillId = skillOrder[(game.state.character.level + attempts) % skillOrder.length];
        const result = game.allocateSkill(skillId);
        if (!result.ok && !game.allocateSkill('mining-power').ok) break;
        attempts += 1;
      }
    }
    if (strategy === 'efficient') {
      ['iron-pickaxe', 'steel-pickaxe', 'hardened-pickaxe'].forEach(buy);
    } else if (strategy === 'casual') {
      [
        'iron-pickaxe', 'leather-work-gloves', 'steel-pickaxe',
        'surveyors-lamp', 'impact-gloves', 'hardened-pickaxe',
      ].forEach(buy);
    }
  }

  while (game.state.cash < game.config.employment.contractBuyoutCost && swings < 20_000) {
    spend();
    game.mine();
    swings += 1;
    if (game.state.employment.rankId !== lastRank) {
      completePendingScenes(game);
      transitions.push({
        rankId: game.state.employment.rankId,
        deposits: game.state.employment.depositsBroken,
        level: game.state.character.level,
        cash: game.state.cash,
        companyValue: game.state.employment.companyValue,
        swings,
      });
      lastRank = game.state.employment.rankId;
    }
    completePendingScenes(game);
    if (game.state.employment.contractDiscovered && !discovery) {
      discovery = {
        deposits: game.state.employment.depositsBroken,
        level: game.state.character.level,
        cash: game.state.cash,
        companyValue: game.state.employment.companyValue,
        swings,
      };
    }
  }

  assert.ok(game.state.cash >= game.config.employment.contractBuyoutCost);
  return {
    transitions,
    discovery,
    final: {
      deposits: game.state.employment.depositsBroken,
      level: game.state.character.level,
      cash: game.state.cash,
      companyValue: game.state.employment.companyValue,
      wages: game.state.employment.totalWages,
      swings,
      depositsAfterDiscovery: game.state.employment.depositsBroken - discovery.deposits,
    },
  };
}

test('employee balance keeps every play style below the buyout at discovery and requires a meaningful saving phase', () => {
  const casual = simulateEmployment('casual');
  const efficient = simulateEmployment('efficient');
  const saveFocused = simulateEmployment('save-focused');

  for (const result of [casual, efficient, saveFocused]) {
    assert.deepEqual(result.transitions.map((entry) => entry.rankId), [
      'mine-worker', 'senior-miner', 'shift-lead',
    ]);
    assert.ok(result.transitions[0].deposits >= 32 && result.transitions[0].deposits <= 45);
    assert.ok(result.transitions[1].deposits >= 80 && result.transitions[1].deposits <= 100);
    assert.equal(result.transitions[2].deposits, 150);
    assert.ok(result.discovery.cash < 1500);
    assert.ok(result.discovery.companyValue >= 9000);
    assert.ok(result.final.depositsAfterDiscovery >= 180);
    assert.ok(result.final.depositsAfterDiscovery <= 350);
    assert.ok(result.final.cash >= 5000);
    assert.ok(result.final.wages >= 5000);
  }
  assert.ok(saveFocused.final.deposits <= efficient.final.deposits);
  assert.ok(efficient.final.deposits <= casual.final.deposits);
});
