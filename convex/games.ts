import { internalMutation, query } from "./_generated/server";
import { listGameMeta } from "../src/lib/games";

/**
 * Game Engine (catalog side).
 *
 * The installed-game catalog is defined in code (the `gameRegistry`). `list`
 * returns it directly so the dashboard is always in sync. `syncCatalog` mirrors
 * it into the `games` table for future admin tooling / feature flags.
 */

export const list = query({
  args: {},
  handler: async () => listGameMeta(),
});

export const syncCatalog = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    for (const meta of listGameMeta()) {
      const existing = await ctx.db
        .query("games")
        .withIndex("by_gameId", (q) => q.eq("gameId", meta.id))
        .unique();
      const doc = {
        gameId: meta.id,
        name: meta.name,
        tagline: meta.tagline,
        description: meta.description,
        minPlayers: meta.minPlayers,
        maxPlayers: meta.maxPlayers,
        estimatedMinutes: meta.estimatedMinutes,
        accent: meta.accent,
        emoji: meta.emoji,
        enabled: true,
        updatedAt: now,
      };
      if (existing) await ctx.db.patch(existing._id, doc);
      else await ctx.db.insert("games", doc);
    }
    return { synced: listGameMeta().length };
  },
});
