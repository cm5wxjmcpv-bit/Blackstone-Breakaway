export const GAME_TYPES = Object.freeze({
  INCREMENTAL: 'incremental',
});

const SUPPORTED_GAME_TYPES = new Set(Object.values(GAME_TYPES));

export function normalizeGameType(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!SUPPORTED_GAME_TYPES.has(normalized)) {
    throw new Error(`Unsupported game type "${normalized || '(empty)'}".`);
  }
  return normalized;
}
