import { query } from "./_generated/server";
import { v } from "convex/values";

export const getMetricsHistory = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("metrics")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit);
    return results.reverse();
  },
});

export const getLogs = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("logs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit);
    return results.reverse();
  },
});
