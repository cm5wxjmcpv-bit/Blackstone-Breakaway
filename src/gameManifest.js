import { normalizeGameType } from './runtimeTypes.js';

const DEFAULT_GAME_ID = 'miner-incremental';

let activeGameId = null;
let activeGamePackagePromise = null;

function currentPageUrl() {
  if (typeof window !== 'undefined' && window.location?.href) {
    return window.location.href;
  }
  return 'http://localhost/';
}

export function getActiveGameId() {
  if (activeGameId) return activeGameId;
  activeGameId = DEFAULT_GAME_ID;
  return activeGameId;
}

export function normalizeGameManifest(manifest, requestedGameId) {
  if (!manifest || typeof manifest !== 'object') {
    throw new Error(`Game manifest for "${requestedGameId}" is not a JSON object.`);
  }

  const manifestId = String(manifest.id || '').trim();
  if (!manifestId) {
    throw new Error(`Game manifest for "${requestedGameId}" is missing an id.`);
  }
  if (manifestId !== requestedGameId) {
    throw new Error(`Game manifest id mismatch: requested "${requestedGameId}" but found "${manifestId}".`);
  }

  return {
    schemaVersion: Number.isInteger(manifest.schemaVersion) ? manifest.schemaVersion : 1,
    id: manifestId,
    gameType: normalizeGameType(manifest.gameType),
    name: String(manifest.name || manifestId),
    version: String(manifest.version || '0.0.0'),
    engineVersion: String(manifest.engineVersion || '0.1.0'),
    description: String(manifest.description || ''),
    contentRoot: String(manifest.contentRoot || './'),
    startScene: manifest.startScene && typeof manifest.startScene === 'object'
      ? manifest.startScene
      : null,
    systems: manifest.systems && typeof manifest.systems === 'object'
      ? manifest.systems
      : {},
    data: manifest.data && typeof manifest.data === 'object'
      ? manifest.data
      : {},
  };
}

export async function loadActiveGamePackage() {
  if (activeGamePackagePromise) return activeGamePackagePromise;

  activeGamePackagePromise = (async () => {
    const gameId = getActiveGameId();
    const manifestUrl = new URL(`./games/${gameId}/game.json`, currentPageUrl());
    const response = await fetch(manifestUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Unable to load game "${gameId}" (${response.status}).`);
    }

    const manifest = normalizeGameManifest(await response.json(), gameId);
    const contentRootUrl = new URL(manifest.contentRoot, manifestUrl);

    return {
      id: manifest.id,
      manifest,
      manifestUrl: manifestUrl.href,
      contentRootUrl: contentRootUrl.href,
    };
  })();

  return activeGamePackagePromise;
}

export function resolveGamePath(gamePackage, relativePath) {
  const path = String(relativePath || '').trim();
  if (!path) {
    throw new Error(`Game "${gamePackage?.id || 'unknown'}" has an empty content path.`);
  }
  return new URL(path, gamePackage.contentRootUrl).href;
}
