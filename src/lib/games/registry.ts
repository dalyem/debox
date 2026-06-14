import type { GameEngine, GameMeta } from "./types";

/**
 * Game Registry.
 *
 * The single source of truth mapping a game id → its engine. Both the Convex
 * server and the browser import the *same* registry, so authoritative logic and
 * client previews can never drift. Adding a game is one `registerGame()` call —
 * the room/lobby/session systems require no changes.
 *
 *   registerGame(PhaseCardsEngine)
 */

const registry = new Map<string, GameEngine>();

export function registerGame(engine: GameEngine): void {
  if (registry.has(engine.meta.id) && registry.get(engine.meta.id) !== engine) {
    throw new Error(`A different game is already registered as "${engine.meta.id}"`);
  }
  registry.set(engine.meta.id, engine);
}

export function getGame(id: string): GameEngine | undefined {
  return registry.get(id);
}

export function getGameOrThrow(id: string): GameEngine {
  const engine = registry.get(id);
  if (!engine) throw new Error(`Unknown game "${id}". Is it registered?`);
  return engine;
}

export function isGameRegistered(id: string): boolean {
  return registry.has(id);
}

export function listGameMeta(): GameMeta[] {
  return [...registry.values()].map((e) => e.meta);
}
