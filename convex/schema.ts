import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Store AI API configurations
  api_configs: defineTable({
    name: v.string(),
    endpoint: v.string(),
    apiKey: v.string(),
    modelName: v.string(),
    provider: v.string(), // e.g., "openai", "anthropic", "custom"
    isActive: v.boolean(),
    createdAt: v.number(),
  }).index("by_name", ["name"]),

  metrics: defineTable({
    timestamp: v.number(),
    efficiencyRatio: v.number(),
    semanticDrift: v.number(),
    wasteIndex: v.number(),
    hallucinationProb: v.number(),
    targetModel: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    latencyMs: v.number(),
    apiConfigId: v.optional(v.id("api_configs")), // Link to API config used
    endpoint: v.optional(v.string()), // Store endpoint for reference
    success: v.boolean(), // Track if the request succeeded
    errorMessage: v.optional(v.string()), // Store any errors
  }).index("by_timestamp", ["timestamp"])
    .index("by_api_config", ["apiConfigId"])
    .index("by_model", ["targetModel"]),

  logs: defineTable({
    timestamp: v.number(),
    level: v.union(v.literal("INFO"), v.literal("ALERT"), v.literal("DEBUG")),
    message: v.string(),
    metadata: v.optional(v.any()),
    apiConfigId: v.optional(v.id("api_configs")), // Link logs to specific API
  }).index("by_timestamp", ["timestamp"])
    .index("by_level", ["level"]),

  raw_inferences: defineTable({
    timestamp: v.number(),
    prompt: v.string(),
    response: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    model: v.string(),
    isAdversarial: v.boolean(),
    apiConfigId: v.optional(v.id("api_configs")), // Link to API config used
    endpoint: v.optional(v.string()),
    latencyMs: v.number(),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    temperature: v.optional(v.number()), // Track generation parameters
    maxTokens: v.optional(v.number()),
  }).index("by_timestamp", ["timestamp"])
    .index("by_api_config", ["apiConfigId"])
    .index("by_model", ["model"])
    .index("by_adversarial", ["isAdversarial"]),
});
