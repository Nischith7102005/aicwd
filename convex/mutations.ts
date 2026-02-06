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
    // New fields for real API response tracking
    apiCallSuccess: v.optional(v.boolean()),
    apiErrorMessage: v.optional(v.string()),
    promptUsed: v.optional(v.string()),
    originalPrompt: v.optional(v.string()),
    promptModifiedByAI: v.optional(v.boolean()),
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
    inputType: v.optional(v.string()),
    sdkSnippet: v.optional(v.string()),
    sdkProvider: v.optional(v.string()),
    sdkModel: v.optional(v.string()),
    sdkParsedConfig: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("apiConfigs", {
      provider: args.provider,
      apiKey: args.apiKey,
      model: args.model,
      timestamp: Date.now(),
      inputType: args.inputType || "apiKey",
      sdkSnippet: args.sdkSnippet,
      sdkProvider: args.sdkProvider,
      sdkModel: args.sdkModel,
      sdkParsedConfig: args.sdkParsedConfig,
    });
  },
});

// Save modified prompts for tracking and comparison
export const savePrompt = mutation({
  args: {
    originalPrompt: v.string(),
    modifiedPrompt: v.string(),
    modificationReason: v.optional(v.string()),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("prompts", {
      originalPrompt: args.originalPrompt,
      modifiedPrompt: args.modifiedPrompt,
      modificationReason: args.modificationReason,
      provider: args.provider,
      model: args.model,
      timestamp: Date.now(),
      usedInTest: false,
    });
  },
});
