import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Scheduled platform maintenance.
 *  • sweep — expire idle rooms + close ended rooms past grace (every 5 min).
 *  • sync  — mirror the in-code game catalog into the `games` table (daily).
 */
const crons = cronJobs();

crons.interval(
  "sweep idle and ended rooms",
  { minutes: 5 },
  internal.sessions.sweep,
  {},
);

crons.daily(
  "sync game catalog",
  { hourUTC: 8, minuteUTC: 0 },
  internal.games.syncCatalog,
  {},
);

export default crons;
