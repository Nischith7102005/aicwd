import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // API configurations provided by users
  api_configs: defineTable({
    provider: v.string(),
    apiKey: v.string(),
    model: v.string(),
    timestamp: v.number(),
  }),

  // Metrics computed from LLM calls
  metrics: defineTable({
    timestamp: v.number(),
    efficiencyRatio: v.number(),
    semanticDrift: v.number(),
    wasteIndex: v.number(),
    hallucinationProb: v.number(),
    censorshipScore: v.optional(v.number()),
    biasScore: v.optional(v.number()),
    targetModel: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    latencyMs: v.number(),
  }).index("by_timestamp", ["timestamp"]),

  // Raw inference data
  raw_inferences: defineTable({
    timestamp: v.number(),
    prompt: v.string(),
    response: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    model: v.string(),
    isAdversarial: v.boolean(),
  }).index("by_timestamp", ["timestamp"]),

  // System logs
  logs: defineTable({
    timestamp: v.number(),
    level: v.union(v.literal("INFO"), v.literal("ALERT"), v.literal("DEBUG")),
    message: v.string(),
    metadata: v.optional(v.any()),
  }).index("by_timestamp", ["timestamp"]),
});
