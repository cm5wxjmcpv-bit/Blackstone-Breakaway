# Blackstone Breakaway

Blackstone Breakaway is a standalone browser-based mining incremental game. Begin as an underpaid Blackstone Mining Co. employee, buy out your contract, build an independent mining company, expand through deeper mines, and eventually acquire your former employer.

Version 0.8.1 adds illustrated deposits, story scenes, a realistic miner, a mine backdrop, and an in-mine XP and cash HUD. It retains the ten progressively richer mines, three connected skill trees, 23 level-gated equipment choices, seven fictional lottery tiers, automated XP training, and separately assigned worksites for Hired Miners, Mining Crews, and Mechanical Drills.

## Play

The hosted game is published through GitHub Pages. Each browser stores its own local save; no account, real-money purchase, or cloud service is required.

## Run locally

Because the game loads its data through `fetch`, serve the repository through a local static server:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080/
```

## Test

```bash
npm install
npx playwright install chromium
npm run audit
```

The audit validates the standalone data contract, incremental runtime, save migrations, gameplay progression, desktop rendering, mobile layout, and save/reload behavior.

Existing version 0.7 local saves migrate automatically to the version 0.8 separate-worksite save schema.

## Repository scope

This repository contains only the playable game, its incremental runtime, game data, tests, and deployment workflow. It does not include the L-C Forge builder, adventure/RPG runtime, Supabase creator storage, or controlled publishing tools.

The fictional lottery uses earned in-game currency only and has no real-world value.
