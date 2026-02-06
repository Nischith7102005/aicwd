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
  }),
});
