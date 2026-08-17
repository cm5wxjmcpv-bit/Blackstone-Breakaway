import { expect, test } from '@playwright/test';

test('miner package selects the incremental runtime, mines deposits, and reloads its isolated save', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-game-type', 'incremental');
  await expect(page.locator('#game-canvas')).toBeHidden();
  await expect(page.locator('#incremental-runtime')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Blackstone Breakaway' })).toBeVisible();
  await expect(page.locator('#incremental-deposit-hp')).toHaveText('20 / 20 HP');
  await expect(page.locator('#incremental-story-title')).toHaveText('First Shift');
  await expect(page.locator('#incremental-story-text')).toContainText('twenty men waiting');
  await expect(page.locator('#incremental-story-figure')).toBeVisible();
  await expect(page.locator('#incremental-story-image')).toHaveAttribute('src', /assets\/story\/first-shift\.webp$/);
  await expect.poll(() => page.locator('#incremental-story-image').evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await page.locator('#incremental-story-continue').click();
  await expect(page.locator('#incremental-buyout')).toBeDisabled();
  await expect(page.locator('#incremental-deposit-art')).toBeVisible();
  await expect(page.locator('#incremental-deposit-art')).toHaveAttribute('src', /assets\/deposits\/stone-face\.webp$/);
  await expect.poll(() => page.locator('#incremental-deposit-art').evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('#incremental-miner-art')).toBeVisible();
  await expect(page.locator('#incremental-miner-art')).toHaveAttribute('src', /assets\/characters\/miner-swing\.webp$/);
  await expect.poll(() => page.locator('#incremental-miner-art').evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('#incremental-mine-stage')).toHaveCSS('background-image', /blackstone-shaft\.webp/);
  await expect(page.locator('#incremental-xp-label')).toHaveText('XP');
  await expect(page.locator('#incremental-mine-xp-progress')).toBeVisible();
  await expect(page.locator('#incremental-mine-cash')).toHaveText('$0');

  const target = page.locator('#incremental-mining-target');
  await target.click();
  await expect(page.locator('#incremental-deposit-hp')).toHaveText('18 / 20 HP');
  await target.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#incremental-deposit-hp')).toHaveText('16 / 20 HP');
  for (let index = 0; index < 8; index += 1) await target.click();

  await expect(page.locator('#incremental-last-result')).toContainText(/delivered to Blackstone Mining Co\./);
  await expect(page.locator('#incremental-cash')).not.toHaveText('$0');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('blackstone_breakaway_save_miner-incremental_slot_1')));
  expect(saved.gameType).toBe('incremental');
  expect(saved.version).toBe(8);
  expect(saved.payload.statistics.totalManualSwings).toBe(10);
  expect(saved.payload.statistics.totalDepositsBroken).toBe(1);
  expect(saved.payload.statistics.totalOreMined).toBeGreaterThan(0);
  expect(saved.payload.character.xp).toBeGreaterThan(0);
  expect(saved.payload.materials.stone).toBe(0);

  const cash = saved.payload.cash;
  await page.reload();
  await expect(page.locator('#incremental-save-status')).toHaveText('Local save loaded');
  const reloaded = await page.evaluate(() => JSON.parse(localStorage.getItem('blackstone_breakaway_save_miner-incremental_slot_1')));
  expect(reloaded.payload.cash).toBe(cash);

  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-game-type', 'incremental');
  await expect(page.locator('#incremental-save-status')).toHaveText('Local save loaded');
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('leveling, skills, and the contract buyout persist the employee-to-independent transition', async ({ page }) => {
  await page.goto('/');
  await page.locator('#incremental-story-continue').click();

  await page.addInitScript(() => {
    if (sessionStorage.getItem('milestone-two-seeded')) return;
    const key = 'blackstone_breakaway_save_miner-incremental_slot_1';
    const save = JSON.parse(localStorage.getItem(key));
    if (!save) return;
    save.payload.cash = 500;
    save.payload.character.xp = 99;
    save.payload.currentDeposit.hp = 2;
    localStorage.setItem(key, JSON.stringify(save));
    sessionStorage.setItem('milestone-two-seeded', 'true');
  });
  await page.reload();
  await expect(page.locator('#incremental-save-status')).toHaveText('Local save loaded');
  await expect(page.locator('#incremental-story-title')).toHaveText('Freedom Is Affordable');
  await page.locator('#incremental-story-continue').click();

  await page.locator('#incremental-mining-target').click();
  await expect(page.locator('#incremental-level')).toHaveText('2');
  await expect(page.locator('#incremental-skill-points')).toHaveText('1');
  await expect(page.locator('#incremental-mine-xp-progress')).toHaveClass(/has-skill-point/);
  await expect(page.locator('#incremental-mine-xp-bar')).toHaveAttribute('style', /width: 100%/);
  await expect(page.locator('#incremental-story-title')).toHaveText('A Stronger Swing');
  await page.locator('#incremental-story-continue').click();

  await page.locator('#incremental-tab-mine').focus();
  await page.keyboard.press('End');
  await expect(page.getByRole('heading', { name: 'Miner Skills' })).toBeVisible();
  const powerSkill = page.locator('.incremental-skill-card').filter({
    has: page.getByRole('heading', { name: 'Mining Power', exact: true }),
  });
  await powerSkill.getByRole('button', { name: 'Spend 1 Point' }).click();
  await expect(powerSkill).toContainText('Rank 1 / 10');
  await expect(page.locator('#incremental-skill-points')).toHaveText('0');
  await expect(page.locator('#incremental-mine-xp-progress')).not.toHaveClass(/has-skill-point/);

  await page.locator('#incremental-tab-mine').click();
  await expect(page.locator('#incremental-manual-power')).toHaveText('3');
  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#incremental-buyout').click();
  await expect(page.locator('#incremental-story-title')).toHaveText('Independent Miner');
  await page.locator('#incremental-story-continue').click();
  await expect(page.locator('#incremental-role')).toHaveText('Independent Miner');
  await expect(page.locator('#incremental-mine-name')).toHaveText('Freedom Claim');
  await expect(page.locator('#incremental-subtitle')).toContainText('belongs to you');
  await expect(page.locator('#incremental-resource-badge')).toHaveText('Player owned');
  await expect(page.locator('#incremental-contract-title')).toHaveText('You Work for Yourself Now');
  await expect(page.locator('#incremental-buyout')).toBeHidden();

  const afterBuyout = await page.evaluate(() => JSON.parse(localStorage.getItem('blackstone_breakaway_save_miner-incremental_slot_1')));
  const wagesBeforeIndependentMining = afterBuyout.payload.employment.totalWages;
  expect(afterBuyout.payload.storyStage).toBe('independent');
  expect(afterBuyout.payload.employment.active).toBe(false);
  expect(afterBuyout.payload.employment.contractBuyoutPaid).toBe(500);
  expect(afterBuyout.payload.cash).toBe(1);

  const target = page.locator('#incremental-mining-target');
  for (let index = 0; index < 15; index += 1) await target.click();
  await expect.poll(async () => page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('blackstone_breakaway_save_miner-incremental_slot_1'));
    return Object.values(save.payload.materials).reduce((sum, quantity) => sum + quantity, 0);
  })).toBeGreaterThan(0);
  const independentSave = await page.evaluate(() => JSON.parse(localStorage.getItem('blackstone_breakaway_save_miner-incremental_slot_1')));
  expect(independentSave.payload.employment.totalWages).toBe(wagesBeforeIndependentMining);

  await page.reload();
  await expect(page.locator('#incremental-save-status')).toHaveText('Local save loaded');
  await expect(page.locator('#incremental-role')).toHaveText('Independent Miner');
  await expect(page.locator('#incremental-resource-badge')).toHaveText('Player owned');
});

test('ore sales, Miller equipment, and scratch tickets persist without bypassing purchase rules', async ({ page }) => {
  await page.goto('/');
  await page.locator('#incremental-story-continue').click();

  await page.addInitScript(() => {
    if (sessionStorage.getItem('milestone-three-seeded')) return;
    const key = 'blackstone_breakaway_save_miner-incremental_slot_1';
    const save = JSON.parse(localStorage.getItem(key));
    if (!save) return;
    save.payload.cash = 100;
    save.payload.character.level = 3;
    save.payload.storyStage = 'independent';
    save.payload.employment.active = false;
    save.payload.employment.contractBuyoutPaid = 500;
    save.payload.employment.endedAt = Date.now();
    save.payload.materials.stone = 12;
    save.payload.milestones = [
      'blackstone-first-shift',
      'blackstone-level-two',
      'contract-within-reach',
      'contract-bought',
    ];
    localStorage.setItem(key, JSON.stringify(save));
    sessionStorage.setItem('milestone-three-seeded', 'true');
  });
  await page.reload();
  await expect(page.locator('#incremental-save-status')).toHaveText('Local save loaded');
  await expect(page.locator('#incremental-resource-badge')).toHaveText('Player owned');

  const stone = page.locator('.incremental-resource-row', { hasText: 'Stone' });
  await expect(stone.getByRole('button', { name: 'Sell 10' })).toBeEnabled();
  await stone.getByRole('button', { name: 'Sell 10' }).click();
  await expect(page.locator('#incremental-cash')).toHaveText('$130');
  await expect(stone).toContainText('2 owned');

  await page.locator('#incremental-tab-store').click();
  await expect(page.getByRole('heading', { name: "Miller's General Store" })).toBeVisible();
  await expect(page.locator('#incremental-store-cash')).toHaveText('$130');
  const ironPickaxe = page.locator('.incremental-equipment-card', { hasText: 'Iron Pickaxe' });
  await ironPickaxe.getByRole('button', { name: /Buy & Equip/ }).click();
  await expect(ironPickaxe.getByRole('button', { name: 'Equipped' })).toBeDisabled();
  await expect(page.locator('#incremental-store-cash')).toHaveText('$100');

  await page.locator('#incremental-tab-equipment').click();
  await expect(page.getByRole('heading', { name: 'Miner Equipment' })).toBeVisible();
  await expect(page.locator('#incremental-equipment-power')).toHaveText('3');
  await expect(page.locator('.incremental-slot-card', { hasText: 'Main Tool' })).toContainText('Iron Pickaxe');

  await page.locator('#incremental-tab-store').click();
  const ticket = page.locator('.incremental-lottery-card', { hasText: 'Gold Vein Scratch-Off' });
  await expect(ticket).toContainText('Prize chances total 100%');
  await ticket.getByRole('button', { name: /Buy Ticket/ }).click();
  await expect(page.locator('#incremental-store-cash')).toHaveText('$90');
  await ticket.getByRole('button', { name: /Scratch Gold Vein Scratch-Off/ }).click();
  await expect(ticket.locator('.incremental-lottery-reveal')).toBeVisible();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('blackstone_breakaway_save_miner-incremental_slot_1')));
  expect(saved.version).toBe(8);
  expect(saved.payload.materials.stone).toBe(2);
  expect(saved.payload.statistics.totalOreSold).toBe(10);
  expect(saved.payload.ownedEquipment).toContain('iron-pickaxe');
  expect(saved.payload.equipment.tool).toBe('iron-pickaxe');
  expect(saved.payload.statistics.lotteryTicketsPurchased).toBe(1);
  expect(saved.payload.cash).toBeGreaterThanOrEqual(0);
  expect(Object.values(saved.payload.materials).every((quantity) => quantity >= 0)).toBe(true);

  await page.reload();
  await expect(page.locator('#incremental-save-status')).toHaveText('Local save loaded');
  await page.locator('#incremental-tab-equipment').click();
  await expect(page.locator('#incremental-equipment-power')).toHaveText('3');
  await expect(page.locator('.incremental-slot-card', { hasText: 'Main Tool' })).toContainText('Iron Pickaxe');
});

test('company creation, scalable generators, upgrades, and deposit automation persist', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.locator('#incremental-story-continue').click();
  await page.addInitScript(() => {
    Math.random = () => 0;
    if (sessionStorage.getItem('milestone-four-seeded')) return;
    const key = 'blackstone_breakaway_save_miner-incremental_slot_1';
    const save = JSON.parse(localStorage.getItem(key));
    if (!save) return;
    save.payload.cash = 50000;
    save.payload.character.level = 3;
    save.payload.character.xp = 0;
    save.payload.storyStage = 'independent';
    save.payload.employment.active = false;
    save.payload.employment.contractBuyoutPaid = 500;
    save.payload.employment.endedAt = Date.now();
    save.payload.currentDeposit.hp = 2;
    save.payload.milestones = [
      'blackstone-first-shift',
      'blackstone-level-two',
      'contract-within-reach',
      'contract-bought',
    ];
    localStorage.setItem(key, JSON.stringify(save));
    sessionStorage.setItem('milestone-four-seeded', 'true');
  });
  await page.reload();
  await expect(page.locator('#incremental-save-status')).toHaveText('Local save loaded');

  await page.locator('#incremental-tab-company').click();
  await expect(page.getByRole('heading', { name: 'Start a Mining Company' })).toBeVisible();
  await expect(page.locator('#incremental-create-company')).toBeDisabled();
  await page.locator('#incremental-company-name').fill('Freedom Forge Mining');
  await expect(page.locator('#incremental-create-company')).toBeEnabled();
  const runtimeScroller = page.locator('#incremental-runtime');
  const popupScrollTop = await runtimeScroller.evaluate((element) => {
    const spacer = document.createElement('div');
    spacer.id = 'popup-scroll-test-spacer';
    spacer.style.height = '500px';
    spacer.setAttribute('aria-hidden', 'true');
    element.appendChild(spacer);
    element.scrollTop = 180;
    return element.scrollTop;
  });
  expect(popupScrollTop).toBeGreaterThan(0);
  await page.locator('#incremental-create-company').evaluate((button) => button.click());
  await expect(page.locator('#incremental-story-title')).toHaveText('A Company of Your Own');
  await expect.poll(() => runtimeScroller.evaluate((element) => element.scrollTop)).toBe(popupScrollTop);
  await page.locator('#incremental-story-continue').evaluate((button) => button.click());
  await expect(page.locator('#incremental-story-title')).toHaveText('Blackstone Expands');
  await expect.poll(() => runtimeScroller.evaluate((element) => element.scrollTop)).toBe(popupScrollTop);
  await page.locator('#incremental-story-continue').evaluate((button) => button.click());
  await expect.poll(() => runtimeScroller.evaluate((element) => element.scrollTop)).toBe(popupScrollTop);
  await page.locator('#popup-scroll-test-spacer').evaluate((element) => element.remove());
  await expect(page.getByRole('heading', { name: 'Freedom Forge Mining' })).toBeVisible();
  await expect(page.locator('#incremental-company-level-summary')).toContainText('Company level 1');
  await expect(page.locator('#incremental-company-production')).toHaveText('0/sec');

  const hiredMiner = page.locator('.incremental-business-card').filter({
    has: page.getByRole('heading', { name: 'Hired Miner', exact: true }),
  });
  await expect(hiredMiner).toContainText('$1.20K');
  await hiredMiner.getByRole('button', { name: /Buy for/ }).click();
  await expect(hiredMiner).toContainText('Owned 1');
  await expect(hiredMiner).toContainText('$1.38K');
  await hiredMiner.getByRole('button', { name: /Buy for/ }).click();
  await expect(hiredMiner).toContainText('Owned 2');
  await expect(hiredMiner).toContainText('$1.59K');
  await hiredMiner.getByRole('button', { name: /Buy for/ }).click();
  await expect(hiredMiner).toContainText('Owned 3');
  await expect(page.locator('#incremental-story-title')).toHaveText('A Major Ore Contract');
  await page.locator('#incremental-story-continue').click();
  await expect(page.locator('#incremental-company-level-summary')).toContainText('Company level 2');
  await expect(page.locator('#incremental-company-production')).toHaveText('3/sec');

  await expect(page.locator('#incremental-last-result')).toContainText('Your separate company worksites broke', { timeout: 10000 });
  const training = page.locator('.incremental-business-card').filter({
    has: page.getByRole('heading', { name: 'Worker Training', exact: true }),
  });
  await training.getByRole('button', { name: /Upgrade for/ }).click();
  await expect(training).toContainText('Rank 1 / 5');
  await expect(page.locator('#incremental-company-production')).toHaveText('3.45/sec');

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('blackstone_breakaway_save_miner-incremental_slot_1')));
  expect(saved.version).toBe(8);
  expect(saved.payload.storyStage).toBe('company-owner');
  expect(saved.payload.company.name).toBe('Freedom Forge Mining');
  expect(saved.payload.company.level).toBe(2);
  expect(saved.payload.company.lifetimeInvestment).toBe(7167);
  expect(saved.payload.generators['hired-miner']).toBe(3);
  expect(saved.payload.businessUpgrades['worker-training']).toBe(1);
  expect(saved.payload.statistics.workersHired).toBe(3);
  expect(saved.payload.statistics.totalAutomatedProduction).toBeGreaterThan(0);
  expect(saved.payload.character.xp).toBeGreaterThan(0);
  expect(saved.payload.statistics.totalAutomatedXp).toBeGreaterThan(0);
  expect(saved.payload.currentDeposit.hp).toBe(2);
  expect(saved.payload.automationDeposits['hired-miner'].hp).toBeGreaterThan(0);
  expect(Object.values(saved.payload.materials).every((quantity) => quantity >= 0)).toBe(true);

  await page.locator('#incremental-tab-mine').click();
  await expect(page.locator('#incremental-crew-operations')).toBeVisible();
  await expect(page.locator('.incremental-crew-card')).toHaveCount(3);
  await expect(page.locator('.incremental-crew-card.is-operating')).toHaveCount(1);
  await expect(page.locator('.incremental-crew-card.is-unowned')).toHaveCount(2);

  await page.reload();
  await expect(page.locator('#incremental-save-status')).toHaveText('Local save loaded');
  await expect(page.locator('#incremental-role')).toHaveText('Founder & Lead Miner');
  await expect(page.locator('#incremental-employer')).toHaveText('Freedom Forge Mining');
  await page.locator('#incremental-tab-company').click();
  await expect(page.locator('#incremental-company-level-summary')).toContainText('Company level 2');
  await expect(page.locator('#incremental-company-production')).toHaveText('3.45/sec');
  await expect(page.locator('.incremental-business-card').filter({
    has: page.getByRole('heading', { name: 'Hired Miner', exact: true }),
  })).toContainText('Owned 3');
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('mine progression shows combined requirements, pays a one-time unlock cost, and switches deposits', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.locator('#incremental-story-continue').click();
  await page.addInitScript(() => {
    if (sessionStorage.getItem('milestone-five-seeded')) return;
    const key = 'blackstone_breakaway_save_miner-incremental_slot_1';
    const save = JSON.parse(localStorage.getItem(key));
    if (!save) return;
    save.payload.cash = 10000;
    save.payload.character.level = 4;
    save.payload.character.xp = 0;
    save.payload.storyStage = 'independent';
    save.payload.employment.active = false;
    save.payload.employment.contractBuyoutPaid = 500;
    save.payload.employment.endedAt = Date.now();
    save.payload.mineProgress['blackstone-shaft-7'] = {
      depositsBroken: 35,
      oreMined: 150,
    };
    save.payload.activeMiningEvent = { id: 'rich-seam', remainingSeconds: 20 };
    save.payload.milestones = [
      'blackstone-first-shift',
      'blackstone-level-two',
      'blackstone-level-four',
      'contract-within-reach',
      'contract-bought',
    ];
    localStorage.setItem(key, JSON.stringify(save));
    sessionStorage.setItem('milestone-five-seeded', 'true');
  });
  await page.reload();
  await expect(page.locator('#incremental-save-status')).toHaveText('Local save loaded');
  await expect(page.locator('#incremental-event-banner')).toBeVisible();
  await expect(page.locator('#incremental-event-name')).toHaveText('Rich Seam');

  await page.locator('#incremental-tab-mines').click();
  await expect(page.getByRole('heading', { name: 'Claims & Shafts' })).toBeVisible();
  const abandonedQuarry = page.locator('.incremental-mine-option').filter({
    has: page.getByRole('heading', { name: 'Abandoned Quarry', exact: true }),
  });
  await expect(abandonedQuarry).toContainText('Contract paid');
  await expect(abandonedQuarry).toContainText('35 / 20');
  await expect(abandonedQuarry).toContainText('$10.00K / $800');
  await abandonedQuarry.getByRole('button', { name: /Unlock/ }).click();
  await expect(page.locator('#incremental-cash')).toHaveText('$9.20K');
  await expect(abandonedQuarry).toContainText('UNLOCKED');
  await abandonedQuarry.getByRole('button', { name: 'Enter Mine' }).click();

  await expect(page.locator('#incremental-mine-view')).toBeVisible();
  await expect(page.locator('#incremental-mine-name')).toHaveText('Abandoned Quarry');
  await expect(page.locator('#incremental-resources')).toContainText('Copper Ore');
  await expect(page.locator('#incremental-deposit-name')).toHaveText(/Stone Face|Coal Seam|Copper Vein/);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('blackstone_breakaway_save_miner-incremental_slot_1')));
  expect(saved.version).toBe(8);
  expect(saved.payload.currentMine).toBe('abandoned-quarry');
  expect(saved.payload.unlockedMines).toContain('abandoned-quarry');
  expect(saved.payload.statistics.minesUnlocked).toBe(2);
  expect(saved.payload.cash).toBe(9200);
  expect(saved.payload.mineProgress['blackstone-shaft-7'].depositsBroken).toBe(35);
  expect(saved.payload.mineProgress['abandoned-quarry'].depositsBroken).toBe(0);
  expect(saved.payload.activeMiningEvent.id).toBe('rich-seam');

  await page.reload();
  await expect(page.locator('#incremental-save-status')).toHaveText('Local save loaded');
  await expect(page.locator('#incremental-mine-name')).toHaveText('Abandoned Quarry');
  await expect(page.locator('#incremental-event-banner')).toBeVisible();
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('high-speed separate worksites keep sale and upgrade controls stable and responsive', async ({ page }) => {
  await page.goto('/');
  await page.locator('#incremental-story-continue').click();
  await page.addInitScript(() => {
    if (sessionStorage.getItem('high-speed-seeded')) return;
    const key = 'blackstone_breakaway_save_miner-incremental_slot_1';
    const save = JSON.parse(localStorage.getItem(key));
    if (!save) return;
    const now = Date.now();
    save.payload.cash = 1_000_000_000;
    save.payload.character.level = 25;
    save.payload.character.xp = 0;
    save.payload.storyStage = 'company-owner';
    save.payload.employment.active = false;
    save.payload.employment.contractBuyoutPaid = 500;
    save.payload.employment.endedAt = now;
    save.payload.company = {
      created: true,
      name: 'Responsive Mining Co.',
      level: 4,
      reputation: 100,
      createdAt: now,
      lifetimeInvestment: 100_000,
    };
    save.payload.unlockedMines = [
      'blackstone-shaft-7', 'abandoned-quarry', 'copper-ridge', 'old-iron-mine',
      'silver-run', 'deep-shaft', 'golden-basin', 'crystal-caverns',
      'ruby-fault', 'ancient-depths',
    ];
    save.payload.generators['hired-miner'] = 500;
    save.payload.generators['mining-crew'] = 200;
    save.payload.generators['mechanical-drill'] = 100;
    save.payload.generatorAssignments = {
      'hired-miner': 'abandoned-quarry',
      'mining-crew': 'deep-shaft',
      'mechanical-drill': 'crystal-caverns',
    };
    save.payload.automationDeposits = {
      'hired-miner': { id: 'stone-face', hp: 20, maxHp: 20 },
      'mining-crew': { id: 'iron-vein', hp: 80, maxHp: 80 },
      'mechanical-drill': { id: 'gold-vein', hp: 240, maxHp: 240 },
    };
    save.payload.materials.stone = 100;
    save.payload.statistics.minesUnlocked = 10;
    save.payload.statistics.workersHired = 1300;
    save.payload.lastPlayed = now;
    save.payload.milestones = [
      'blackstone-first-shift', 'blackstone-level-two', 'blackstone-level-four',
      'contract-within-reach', 'contract-bought', 'company-founded',
      'blackstone-new-shaft', 'blackstone-major-contract', 'blackstone-notices-operation',
      'blackstone-purchase-offer', 'blackstone-production-surpassed',
    ];
    localStorage.setItem(key, JSON.stringify(save));
    sessionStorage.setItem('high-speed-seeded', 'true');
  });
  await page.reload();
  await expect(page.locator('#incremental-save-status')).toHaveText('Local save loaded');
  await expect(page.locator('#incremental-crew-operations')).toBeVisible();
  await expect(page.locator('.incremental-crew-card.is-operating')).toHaveCount(3);
  await expect(page.locator('select[data-assign-generator-id="hired-miner"]')).toHaveValue('abandoned-quarry');
  await expect(page.locator('select[data-assign-generator-id="mining-crew"]')).toHaveValue('deep-shaft');
  await expect(page.locator('select[data-assign-generator-id="mechanical-drill"]')).toHaveValue('crystal-caverns');
  await expect(page.locator('#incremental-deposit-hp')).toHaveText('20 / 20 HP');
  await page.locator('select[data-assign-generator-id="hired-miner"]').selectOption('copper-ridge');
  await expect(page.locator('#incremental-crew-status')).toContainText('Hired Miner assigned to Copper Ridge Claim');
  const reassigned = await page.evaluate(() => JSON.parse(localStorage.getItem('blackstone_breakaway_save_miner-incremental_slot_1')));
  expect(reassigned.payload.generatorAssignments['hired-miner']).toBe('copper-ridge');

  const sellStone = page.locator('button[data-sell-resource-id="stone"][data-sell-quantity="1"]');
  await sellStone.evaluate((button) => { button.dataset.stabilityMarker = 'same-node'; });
  await page.waitForTimeout(1200);
  await expect(sellStone).toHaveAttribute('data-stability-marker', 'same-node');
  await sellStone.click();
  const afterSale = await page.evaluate(() => JSON.parse(localStorage.getItem('blackstone_breakaway_save_miner-incremental_slot_1')));
  expect(afterSale.payload.cash).toBe(1_000_000_003);
  expect(afterSale.payload.currentDeposit.hp).toBe(20);
  expect(afterSale.payload.statistics.totalAutomatedProduction).toBeGreaterThan(0);

  await page.locator('#incremental-tab-company').click();
  const training = page.locator('.incremental-business-card').filter({
    has: page.getByRole('heading', { name: 'Worker Training', exact: true }),
  });
  const upgradeButton = training.getByRole('button', { name: /Upgrade for/ });
  await upgradeButton.evaluate((button) => { button.dataset.stabilityMarker = 'same-node'; });
  await page.waitForTimeout(1200);
  await expect(upgradeButton).toHaveAttribute('data-stability-marker', 'same-node');
  await upgradeButton.click();
  await expect(training).toContainText('Rank 1 / 5');
});

test('offline company production is capped, summarized, saved once, and excludes expired mining events', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.locator('#incremental-story-continue').click();
  await page.addInitScript(() => {
    if (sessionStorage.getItem('milestone-six-seeded')) return;
    const key = 'blackstone_breakaway_save_miner-incremental_slot_1';
    const save = JSON.parse(localStorage.getItem(key));
    if (!save) return;
    const now = Date.now();
    save.payload.cash = 5000;
    save.payload.character.level = 3;
    save.payload.storyStage = 'company-owner';
    save.payload.employment.active = false;
    save.payload.employment.contractBuyoutPaid = 500;
    save.payload.employment.endedAt = now - 10_000;
    save.payload.company = {
      created: true,
      name: 'Away Shift Mining',
      level: 1,
      reputation: 0,
      createdAt: now - 10_000,
      lifetimeInvestment: 0,
    };
    save.payload.generators['hired-miner'] = 2;
    save.payload.activeMiningEvent = { id: 'rich-seam', remainingSeconds: 20 };
    save.payload.lastPlayed = now - (2 * 60 * 60 * 1000);
    save.payload.milestones = [
      'blackstone-first-shift',
      'blackstone-level-two',
      'contract-within-reach',
      'contract-bought',
      'company-founded',
    ];
    localStorage.setItem(key, JSON.stringify(save));
    sessionStorage.setItem('milestone-six-seeded', 'true');
  });
  await page.reload();

  await expect(page.locator('#incremental-save-status')).toHaveText('Local save loaded');
  await expect(page.locator('#incremental-offline-overlay')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your Operation Kept Working' })).toBeVisible();
  await expect(page.locator('#incremental-offline-time-away')).toContainText('2h');
  await expect(page.locator('#incremental-offline-time-credited')).toContainText('2h');
  await expect(page.locator('#incremental-offline-production')).toContainText('deposits');
  await expect(page.locator('#incremental-offline-resources > div')).not.toHaveCount(0);
  await expect(page.locator('#incremental-offline-value')).not.toHaveText('$0');
  await expect(page.locator('#incremental-offline-note')).toContainText('expired while you were away');
  await page.locator('#incremental-offline-continue').click();
  await expect(page.locator('#incremental-offline-overlay')).toBeHidden();
  await expect(page.locator('#incremental-event-banner')).toBeHidden();

  const firstReturn = await page.evaluate(() => JSON.parse(localStorage.getItem('blackstone_breakaway_save_miner-incremental_slot_1')));
  expect(firstReturn.version).toBe(8);
  expect(firstReturn.payload.statistics.totalOfflineProduction).toBeGreaterThan(0);
  expect(firstReturn.payload.statistics.totalOfflineTime).toBeGreaterThanOrEqual(7200);
  expect(firstReturn.payload.statistics.offlineSessions).toBe(1);
  expect(firstReturn.payload.activeMiningEvent).toBeNull();
  expect(Object.values(firstReturn.payload.materials).every((quantity) => quantity >= 0)).toBe(true);

  const offlineProduction = firstReturn.payload.statistics.totalOfflineProduction;
  await page.reload();
  await expect(page.locator('#incremental-save-status')).toHaveText('Local save loaded');
  await expect(page.locator('#incremental-offline-overlay')).toBeHidden();
  const secondReturn = await page.evaluate(() => JSON.parse(localStorage.getItem('blackstone_breakaway_save_miner-incremental_slot_1')));
  expect(secondReturn.payload.statistics.totalOfflineProduction).toBe(offlineProduction);
  expect(secondReturn.payload.statistics.offlineSessions).toBe(1);
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test('Blackstone competition requirements, acquisition, story completion, and production benefit persist', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await page.locator('#incremental-story-continue').click();
  await page.addInitScript(() => {
    if (sessionStorage.getItem('milestone-seven-seeded')) return;
    const key = 'blackstone_breakaway_save_miner-incremental_slot_1';
    const save = JSON.parse(localStorage.getItem(key));
    if (!save) return;
    const now = Date.now();
    save.payload.cash = 250_000_000;
    save.payload.character.level = 22;
    save.payload.character.xp = 0;
    save.payload.storyStage = 'company-owner';
    save.payload.employment.active = false;
    save.payload.employment.contractBuyoutPaid = 500;
    save.payload.employment.endedAt = now - 10_000;
    save.payload.company = {
      created: true,
      name: 'Freedom Forge Mining',
      level: 4,
      reputation: 100,
      createdAt: now - 10_000,
      lifetimeInvestment: 100_000,
    };
    save.payload.competition = {
      rivalId: 'blackstone-mining',
      acquired: false,
      acquiredAt: null,
      acquisitionPricePaid: 0,
    };
    save.payload.unlockedMines = [
      'blackstone-shaft-7',
      'abandoned-quarry',
      'copper-ridge',
      'old-iron-mine',
      'silver-run',
      'deep-shaft',
      'golden-basin',
      'crystal-caverns',
      'ruby-fault',
      'ancient-depths',
    ];
    save.payload.generators['mechanical-drill'] = 40;
    save.payload.statistics.minesUnlocked = 10;
    save.payload.statistics.totalOreMined = 1_000_000;
    save.payload.statistics.totalAutomatedProduction = 250_000;
    save.payload.statistics.companiesAcquired = 0;
    save.payload.lastPlayed = now;
    save.payload.milestones = [
      'blackstone-first-shift',
      'blackstone-level-two',
      'blackstone-level-four',
      'contract-within-reach',
      'contract-bought',
      'company-founded',
      'blackstone-new-shaft',
      'blackstone-major-contract',
      'blackstone-notices-operation',
      'blackstone-purchase-offer',
      'blackstone-production-surpassed',
    ];
    localStorage.setItem(key, JSON.stringify(save));
    sessionStorage.setItem('milestone-seven-seeded', 'true');
  });
  await page.reload();
  await expect(page.locator('#incremental-save-status')).toHaveText('Local save loaded');
  await page.locator('#incremental-tab-company').click();

  await expect(page.getByRole('heading', { name: 'Blackstone Mining Co.', exact: true })).toBeVisible();
  await expect(page.locator('#incremental-rival-status')).toHaveText('Former Employer & Rival');
  await expect(page.locator('#incremental-company-reputation')).toHaveText('100 / 100');
  await expect(page.locator('#incremental-company-production')).toHaveText('1.00K/sec');
  await expect(page.locator('#incremental-acquisition-requirements .is-met')).toHaveCount(7);
  await expect(page.locator('#incremental-acquire-company')).toBeEnabled();

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('#incremental-acquire-company').click();
  await expect(page.locator('#incremental-story-title')).toHaveText('The Company Is Yours');
  await expect(page.locator('#incremental-story-text')).toContainText('shaft where you started');
  await expect(page.locator('#incremental-story-image')).toHaveAttribute('src', /assets\/story\/blackstone-new-shift\.webp$/);
  await expect.poll(() => page.locator('#incremental-story-image').evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);
  await page.locator('#incremental-story-continue').click();

  await expect(page.locator('#incremental-rival-status')).toHaveText('Acquired');
  await expect(page.locator('#incremental-acquisition-bonus')).toHaveText('2.5x active');
  await expect(page.locator('#incremental-company-production')).toHaveText('2.50K/sec');
  await expect(page.locator('#incremental-acquire-company')).toBeDisabled();
  await expect(page.locator('#incremental-employer')).toContainText('Blackstone Mining Co.');

  const acquired = await page.evaluate(() => JSON.parse(localStorage.getItem('blackstone_breakaway_save_miner-incremental_slot_1')));
  expect(acquired.version).toBe(8);
  expect(acquired.payload.cash).toBe(0);
  expect(acquired.payload.storyStage).toBe('blackstone-owner');
  expect(acquired.payload.competition.acquired).toBe(true);
  expect(acquired.payload.competition.acquisitionPricePaid).toBe(250_000_000);
  expect(acquired.payload.statistics.companiesAcquired).toBe(1);
  expect(acquired.payload.milestones).toContain('blackstone-acquisition');

  await page.reload();
  await expect(page.locator('#incremental-save-status')).toHaveText('Local save loaded');
  await page.locator('#incremental-tab-company').click();
  await expect(page.locator('#incremental-rival-status')).toHaveText('Acquired');
  await expect(page.locator('#incremental-company-production')).toHaveText('2.50K/sec');
  expect(consoleErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test.describe('touch viewport', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('miner target remains touch-sized and contained on a phone viewport', async ({ page }) => {
    await page.goto('/');
    await page.locator('#incremental-story-continue').click();
    const navButtons = page.locator('.incremental-nav [role="tab"]');
    await expect(navButtons).toHaveCount(6);
    expect(await page.locator('.incremental-nav').evaluate((element) => getComputedStyle(element).position)).toBe('static');
    for (let index = 0; index < await navButtons.count(); index += 1) {
      const navButtonBox = await navButtons.nth(index).boundingBox();
      expect(navButtonBox.height).toBeGreaterThanOrEqual(44);
      expect(navButtonBox.x).toBeGreaterThanOrEqual(0);
      expect(navButtonBox.x + navButtonBox.width).toBeLessThanOrEqual(390);
    }
    const target = page.locator('#incremental-mining-target');
    await expect(target).toBeVisible();
    await expect(page.locator('#incremental-mine-xp-progress')).toBeVisible();
    await expect(page.locator('#incremental-mine-cash')).toBeVisible();
    const box = await target.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(200);
    expect(box.height).toBeGreaterThanOrEqual(200);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    await target.tap();
    await expect(page.locator('#incremental-deposit-hp')).toHaveText('18 / 20 HP');

    await page.locator('#incremental-tab-store').tap();
    await expect(page.getByRole('heading', { name: "Miller's General Store" })).toBeVisible();
    const navBox = await page.locator('#incremental-tab-store').boundingBox();
    expect(navBox.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.locator('#incremental-tab-equipment').tap();
    await expect(page.getByRole('heading', { name: 'Miner Equipment' })).toBeVisible();
    await page.locator('#incremental-tab-skills').tap();
    await expect(page.getByRole('heading', { name: 'Miner Skills' })).toBeVisible();
    await page.locator('#incremental-tab-mine').tap();
    await expect(target).toBeVisible();

    await page.addInitScript(() => {
      if (sessionStorage.getItem('mobile-company-seeded')) return;
      const key = 'blackstone_breakaway_save_miner-incremental_slot_1';
      const save = JSON.parse(localStorage.getItem(key));
      if (!save) return;
      save.payload.cash = 5000;
      save.payload.character.level = 3;
      save.payload.storyStage = 'company-owner';
      save.payload.employment.active = false;
      save.payload.employment.contractBuyoutPaid = 500;
      save.payload.employment.endedAt = Date.now();
      save.payload.company = {
        created: true,
        name: 'Pocket Mine Co.',
        level: 1,
        reputation: 10,
        createdAt: Date.now(),
        lifetimeInvestment: 0,
      };
      save.payload.generators['hired-miner'] = 1;
      save.payload.materials.stone = 12;
      save.payload.lastPlayed = Date.now() - (60 * 60 * 1000);
      save.payload.milestones = [
        'blackstone-first-shift',
        'blackstone-level-two',
        'contract-within-reach',
        'contract-bought',
        'company-founded',
        'blackstone-new-shaft',
      ];
      localStorage.setItem(key, JSON.stringify(save));
      sessionStorage.setItem('mobile-company-seeded', 'true');
    });
    await page.reload();
    await expect(page.locator('#incremental-offline-overlay')).toBeVisible();
    const offlineDialogBox = await page.locator('.incremental-offline-dialog').boundingBox();
    expect(offlineDialogBox.x).toBeGreaterThanOrEqual(0);
    expect(offlineDialogBox.x + offlineDialogBox.width).toBeLessThanOrEqual(390);
    await page.locator('#incremental-offline-continue').tap();
    await expect(page.locator('#incremental-crew-operations')).toBeVisible();
    await expect(page.locator('.incremental-crew-card')).toHaveCount(3);
    const assignmentControl = page.locator('.incremental-crew-card select').first();
    await expect(assignmentControl).toBeEnabled();
    const assignmentControlBox = await assignmentControl.boundingBox();
    expect(assignmentControlBox.height).toBeGreaterThanOrEqual(44);
    const crewCardBox = await page.locator('.incremental-crew-card').first().boundingBox();
    expect(crewCardBox.x).toBeGreaterThanOrEqual(0);
    expect(crewCardBox.x + crewCardBox.width).toBeLessThanOrEqual(390);
    await page.locator('#incremental-tab-company').tap();
    await expect(page.getByRole('heading', { name: 'Pocket Mine Co.' })).toBeVisible();
    const companyCard = page.locator('.incremental-business-card').first();
    const companyCardBox = await companyCard.boundingBox();
    expect(companyCardBox.x).toBeGreaterThanOrEqual(0);
    expect(companyCardBox.x + companyCardBox.width).toBeLessThanOrEqual(390);
    const companyPurchaseButton = companyCard.getByRole('button').first();
    const companyPurchaseButtonBox = await companyPurchaseButton.boundingBox();
    expect(companyPurchaseButtonBox.height).toBeGreaterThanOrEqual(44);
    const competitionCardBox = await page.locator('#incremental-competition-panel').boundingBox();
    expect(competitionCardBox.x).toBeGreaterThanOrEqual(0);
    expect(competitionCardBox.x + competitionCardBox.width).toBeLessThanOrEqual(390);
    await page.locator('#incremental-tab-mines').tap();
    await expect(page.getByRole('heading', { name: 'Claims & Shafts' })).toBeVisible();
    const mineCard = page.locator('.incremental-mine-option').first();
    const mineCardBox = await mineCard.boundingBox();
    expect(mineCardBox.x).toBeGreaterThanOrEqual(0);
    expect(mineCardBox.x + mineCardBox.width).toBeLessThanOrEqual(390);
    await page.locator('#incremental-tab-mine').tap();
    const mobileSellButton = page.locator('.incremental-resource-row', { hasText: 'Stone' })
      .getByRole('button', { name: 'Sell 1', exact: true });
    await expect(mobileSellButton).toBeEnabled();
    const mobileSellButtonBox = await mobileSellButton.boundingBox();
    expect(mobileSellButtonBox.height).toBeGreaterThanOrEqual(44);
    const cashBeforeMobileSale = await page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('blackstone_breakaway_save_miner-incremental_slot_1'));
      return save.payload.cash;
    });
    await mobileSellButton.tap();
    await expect.poll(() => page.evaluate(() => {
      const save = JSON.parse(localStorage.getItem('blackstone_breakaway_save_miner-incremental_slot_1'));
      return save.payload.cash;
    })).toBe(cashBeforeMobileSale + 3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});
