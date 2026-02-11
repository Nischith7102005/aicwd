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
    // Additional fields for ingest.ts compatibility
    configId: v.optional(v.id("apiConfigs")),
    tokensPerSecond: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    success: v.optional(v.boolean()),
    error: v.optional(v.string()),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_config", ["configId"]),

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
    // Additional fields for ingest.ts compatibility
    modelName: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
    inputPricePer1M: v.optional(v.number()),
    outputPricePer1M: v.optional(v.number()),
    name: v.optional(v.string()),
  }),

  // Raw logs table for detailed inference logging
  raw_logs: defineTable({
    timestamp: v.number(),
    prompt: v.string(),
    response: v.optional(v.string()),
    inputTokens: v.number(),
    outputTokens: v.number(),
    latency: v.number(),
    model: v.string(),
    provider: v.string(),
    configId: v.optional(v.id("apiConfigs")),
    isAdversarial: v.boolean(),
    error: v.optional(v.string()),
  }),

  // Batch comparisons table for multi-model testing
  batch_comparisons: defineTable({
    timestamp: v.number(),
    batchId: v.string(),
    prompt: v.string(),
    configIds: v.array(v.id("apiConfigs")),
    resultCount: v.number(),
  }),

  // Raw inferences table (used by metrics.ts)
  raw_inferences: defineTable({
    timestamp: v.number(),
    prompt: v.string(),
    response: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    model: v.string(),
    isAdversarial: v.boolean(),
  }),
});
