import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const insertMetrics = mutation({
  args: {
    efficiencyRatio: v.number(),
    semanticDrift: v.number(),
    wasteIndex: v.number(),
    hallucinationProb: v.number(),
    censorshipScore: v.number(),
    biasScore: v.number(),
    targetModel: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    latencyMs: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("metrics", {
      timestamp: Date.now(),
      ...args,
    });
  },
});

export const insertLog = mutation({
  args: {
    level: v.union(v.literal("INFO"), v.literal("ALERT"), v.literal("DEBUG")),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("logs", {
      timestamp: Date.now(),
      level: args.level,
      message: args.message,
    });
  },
});

export const insertRawInference = mutation({
  args: {
    prompt: v.string(),
    response: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    model: v.string(),
    isAdversarial: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("raw_inferences", {
      timestamp: Date.now(),
      ...args,
    });
  },
});
