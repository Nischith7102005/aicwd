import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Raw LLM interaction logs
  logs: defineTable({
    timestamp: v.number(),
    prompt: v.string(),
    response: v.string(),
    promptTokens: v.number(),
    responseTokens: v.number(),
    latency: v.number(),
    model: v.string(),
    metadata: v.optional(v.any()),
    docType: v.literal("log"),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_model", ["model"]),

  // Computed metrics from DBT
  metrics: defineTable({
    timestamp: v.number(),
    tokenEfficiency: v.number(), // tokens per semantic unit
    cognitiveWaste: v.number(), // waste score
    semanticDrift: v.number(), // embedding deviation
    adversarialStress: v.number(), // stress level 0-1
    fragilityScore: v.number(), // resilience delta
    docType: v.literal("metric"),
  })
    .index("by_timestamp", ["timestamp"]),

  // Red-team execution state
  redTeamRuns: defineTable({
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    progress: v.number(), // 0-100
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    totalPrompts: v.number(),
    processedPrompts: v.number(),
    docType: v.literal("redTeamRun"),
  })
    .index("by_status", ["status"])
    .index("by_startedAt", ["startedAt"]),

  // Red-team findings
  redTeamFindings: defineTable({
    runId: v.id("redTeamRuns"),
    prompt: v.string(),
    response: v.string(),
    jailbreakAttempted: v.boolean(),
    jailbreakSuccess: v.optional(v.boolean()),
    adversarialType: v.string(), // jailbreak, logic_puzzle, semantic_overload, contradiction
    wasteScore: v.number(),
    baselineComparison: v.number(),
    wastefulSections: v.array(v.string()),
    docType: v.literal("finding"),
  })
    .index("by_runId", ["runId"])
    .index("by_adversarialType", ["adversarialType"]),
});
