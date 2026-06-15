/**
 * Game catalog entry-point.
 *
 * Importing this module registers every installed game with the platform
 * `gameRegistry`. The Convex server and the browser both import from here, so a
 * single registration list keeps server logic and client UI perfectly in sync.
 *
 * To ship a new game: build its engine, then add one line below. Nothing in the
 * room / lobby / session systems changes.
 */
import { registerGame } from "./registry";
import { PhaseCardsEngine } from "./phase-cards/engine";
import { SpadesEngine } from "./spades/engine";
import { CheatEngine } from "./cheat/engine";
import { WordRushEngine } from "./word-rush/engine";

registerGame(PhaseCardsEngine);
registerGame(SpadesEngine);
registerGame(CheatEngine);
registerGame(WordRushEngine);

export * from "./types";
export * from "./registry";
export { PhaseCardsEngine, SpadesEngine, CheatEngine, WordRushEngine };
