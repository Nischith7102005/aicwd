import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const saveMetrics = mutation({
  args: {
    inputTokens: v.number(),
    outputTokens: v.number(),
    efficiencyRatio: v.number(),
    wasteIndex: v.number(),
    semanticDrift: v.number(),
    hallucinationProb: v.number(),
    censorshipScore: v.number(),
    biasScore: v.number(),
    latencyMs: v.number(),
    provider: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("metrics", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const addLog = mutation({
  args: {
    level: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("logs", {
      level: args.level,
      message: args.message,
      timestamp: Date.now(),
    });
  },
});

export const saveApiConfig = mutation({
  args: {
    provider: v.string(),
    apiKey: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("apiConfigs", {
      provider: args.provider,
      apiKey: args.apiKey,
      model: args.model,
      timestamp: Date.now(),
    });
  },
});
