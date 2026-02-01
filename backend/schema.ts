import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  raw_logs: defineTable({
    timestamp: v.number(),
    prompt: v.string(),
    response: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    model: v.string(),
    isAdversarial: v.boolean()
  }).index("by_time", ["timestamp"]),

  metrics: defineTable({
    timestamp: v.number(),
    efficiencyRatio: v.number(),
    semanticDrift: v.number(),
    wasteIndex: v.number(),
    hallucinationProb: v.number(),
    targetModel: v.optional(v.string())
  }),

  system_logs: defineTable({
    timestamp: v.string(),
    type: v.string(),
    message: v.string()
  })
});