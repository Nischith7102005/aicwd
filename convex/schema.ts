import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  metrics: defineTable({
    timestamp: v.number(),
    efficiencyRatio: v.number(),
    semanticDrift: v.number(),
    wasteIndex: v.number(),
    targetModel: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    latencyMs: v.number(),
    // These 3 didn't exist in earlier probes, so they must be optional
    hallucinationProb: v.optional(v.number()),
    censorshipScore: v.optional(v.number()),
    biasScore: v.optional(v.number()),
  }).index("by_timestamp", ["timestamp"]),

  logs: defineTable({
    timestamp: v.number(),
    level: v.union(v.literal("INFO"), v.literal("ALERT"), v.literal("DEBUG")),
    message: v.string(),
  }).index("by_timestamp", ["timestamp"]),

  raw_inferences: defineTable({
    timestamp: v.number(),
    prompt: v.string(),
    response: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    model: v.string(),
    isAdversarial: v.boolean(),
  }).index("by_timestamp", ["timestamp"]),
});
