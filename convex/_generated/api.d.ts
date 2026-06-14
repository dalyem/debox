/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as events from "../events.js";
import type * as gameplay from "../gameplay.js";
import type * as games from "../games.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_engine from "../lib/engine.js";
import type * as lib_guestTokens from "../lib/guestTokens.js";
import type * as lib_roomCodes from "../lib/roomCodes.js";
import type * as players from "../players.js";
import type * as rooms from "../rooms.js";
import type * as sessions from "../sessions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  events: typeof events;
  gameplay: typeof gameplay;
  games: typeof games;
  "lib/auth": typeof lib_auth;
  "lib/engine": typeof lib_engine;
  "lib/guestTokens": typeof lib_guestTokens;
  "lib/roomCodes": typeof lib_roomCodes;
  players: typeof players;
  rooms: typeof rooms;
  sessions: typeof sessions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
