import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  metrics: defineTable({
    inputTokens: v.number(),
    outputTokens: v.number(),
    efficiencyRatio: v.number(),
    wasteIndex: v.number(),
    semanticDrift: v.number(),
    hallucinationProb: v.optional(v.number()),
    censorshipScore: v.optional(v.number()),
    biasScore: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    targetModel: v.optional(v.string()), // legacy field from old schema
    timestamp: v.number(),
    // SDK and API response metadata
    apiCallSuccess: v.optional(v.boolean()),
    apiErrorMessage: v.optional(v.string()),
    promptUsed: v.optional(v.string()),
    originalPrompt: v.optional(v.string()),
    promptModifiedByAI: v.optional(v.boolean()),
  }).index("by_timestamp", ["timestamp"]),

  logs: defineTable({
    level: v.string(),
    message: v.string(),
    timestamp: v.number(),
  }).index("by_timestamp", ["timestamp"]),

  apiConfigs: defineTable({
    provider: v.string(),
    apiKey: v.string(),
    model: v.string(),
    timestamp: v.number(),
    // SDK-style configuration support
    inputType: v.optional(v.string()), // "apiKey" or "sdkSnippet"
    sdkSnippet: v.optional(v.string()), // Original SDK code snippet
    sdkProvider: v.optional(v.string()), // Provider detected from SDK
    sdkModel: v.optional(v.string()), // Model detected from SDK
    sdkParsedConfig: v.optional(v.any()), // Parsed SDK configuration object
  }),

  // Store dynamic prompts modified by uncensored AI
  prompts: defineTable({
    originalPrompt: v.string(),
    modifiedPrompt: v.string(),
    modificationReason: v.optional(v.string()),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    timestamp: v.number(),
    usedInTest: v.optional(v.boolean()),
  }).index("by_timestamp", ["timestamp"]),
});
