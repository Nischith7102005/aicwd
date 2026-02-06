import { query } from "./_generated/server";
import { v } from "convex/values";

export const getMetricsHistory = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("metrics")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit)
      .then((rows) => rows.reverse()); // chronological order
  },
});

export const getLogs = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("logs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit)
      .then((rows) => rows.reverse());
  },
});

export const getPrompts = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    return await ctx.db
      .query("prompts")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit)
      .then((rows) => rows.reverse());
  },
});

export const getLatestPrompt = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("prompts")
      .withIndex("by_timestamp")
      .order("desc")
      .first();
  },
});
