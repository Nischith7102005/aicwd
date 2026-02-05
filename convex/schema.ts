import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Store AI API configurations
  api_configs: defineTable({
    name: v.string(),
    endpoint: v.string(), // Base URL for API
    apiKey: v.string(),
    modelName: v.string(),
    provider: v.string(), // e.g., "openai", "anthropic", "gemini", "custom"
    isActive: v.boolean(),
    createdAt: v.number(),
    // Pricing information (per 1M tokens)
    inputPricePer1M: v.optional(v.number()), // Cost per 1M input tokens in USD
    outputPricePer1M: v.optional(v.number()), // Cost per 1M output tokens in USD
    // Default parameters
    defaultTemperature: v.optional(v.number()),
    defaultMaxTokens: v.optional(v.number()),
    // Metadata
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  })
    .index("by_name", ["name"])
    .index("by_provider", ["provider"])
    .index("by_active", ["isActive"]),

  // Aggregated metrics per inference
  metrics: defineTable({
    timestamp: v.number(),
    // Token metrics
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(), // inputTokens + outputTokens
    // Performance metrics
    latencyMs: v.number(),
    tokensPerSecond: v.number(), // Output tokens / (latency in seconds)
    // Cost tracking
    costUsd: v.number(), // Total cost for this inference
    inputCostUsd: v.number(),
    outputCostUsd: v.number(),
    // Quality metrics (calculated or placeholder)
    efficiencyRatio: v.optional(v.number()), // Ratio of output/input tokens
    outputRatio: v.optional(v.number()), // output / (input + output)
    semanticDrift: v.optional(v.number()), // Semantic similarity score (0-1)
    wasteIndex: v.optional(v.number()), // Wasted tokens metric
    hallucinationScore: v.optional(v.number()), // Hallucination probability (0-1)
    coherenceScore: v.optional(v.number()), // Response coherence (0-1)
    relevanceScore: v.optional(v.number()), // Prompt relevance (0-1)
    // Model info
    targetModel: v.string(),
    provider: v.string(),
    apiConfigId: v.id("api_configs"), // Link to API config used
    endpoint: v.string(), // Store endpoint for reference
    // Status
    success: v.boolean(), // Track if the request succeeded
    errorMessage: v.optional(v.string()), // Store any errors
    errorType: v.optional(v.string()), // e.g., "rate_limit", "timeout", "invalid_request"
    // Request parameters
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    systemPrompt: v.optional(v.string()),
    // Batch tracking
    batchId: v.optional(v.string()), // If part of a batch comparison
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_api_config", ["apiConfigId", "timestamp"])
    .index("by_model", ["targetModel", "timestamp"])
    .index("by_provider", ["provider", "timestamp"])
    .index("by_success", ["success", "timestamp"])
    .index("by_batch", ["batchId"]),

  // System logs for monitoring and debugging
  logs: defineTable({
    timestamp: v.number(),
    level: v.union(
      v.literal("INFO"),
      v.literal("ALERT"),
      v.literal("DEBUG"),
      v.literal("WARN"),
      v.literal("ERROR")
    ),
    message: v.string(),
    category: v.optional(v.string()), // e.g., "api", "security", "performance"
    metadata: v.optional(v.any()),
    apiConfigId: v.optional(v.id("api_configs")), // Link logs to specific API
    source: v.optional(v.string()), // Which mutation/action generated this
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_level", ["level", "timestamp"])
    .index("by_category", ["category", "timestamp"])
    .index("by_api_config", ["apiConfigId", "timestamp"]),

  // Raw inference data for detailed analysis
  raw_inferences: defineTable({
    timestamp: v.number(),
    // Request data
    prompt: v.string(),
    systemPrompt: v.optional(v.string()),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    // Response data
    response: v.optional(v.string()), // Null if request failed
    finishReason: v.optional(v.string()), // "stop", "length", "content_filter", etc.
    // Token counts
    inputTokens: v.number(),
    outputTokens: v.number(),
    // Model info
    model: v.string(),
    provider: v.string(),
    apiConfigId: v.id("api_configs"), // Link to API config used
    endpoint: v.string(),
    // Performance
    latencyMs: v.number(),
    firstTokenLatencyMs: v.optional(v.number()), // Time to first token (streaming)
    // Status
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    errorType: v.optional(v.string()),
    statusCode: v.optional(v.number()), // HTTP status code
    // Classification
    isAdversarial: v.boolean(), // If this was an adversarial test
    testType: v.optional(v.string()), // Type of test: "jailbreak", "prompt_injection", etc.
    // Batch tracking
    batchId: v.optional(v.string()),
    // Metadata
    userId: v.optional(v.string()), // If tracking per-user
    sessionId: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_api_config", ["apiConfigId", "timestamp"])
    .index("by_model", ["model", "timestamp"])
    .index("by_provider", ["provider", "timestamp"])
    .index("by_adversarial", ["isAdversarial", "timestamp"])
    .index("by_success", ["success", "timestamp"])
    .index("by_batch", ["batchId"])
    .index("by_user", ["userId", "timestamp"]),

  // Batch comparison results
  batch_comparisons: defineTable({
    timestamp: v.number(),
    batchId: v.string(), // Unique ID for this batch
    prompt: v.string(),
    systemPrompt: v.optional(v.string()),
    // Configs being compared
    apiConfigIds: v.array(v.id("api_configs")),
    configCount: v.number(),
    // Results summary
    successCount: v.number(),
    failureCount: v.number(),
    totalLatencyMs: v.number(),
    avgLatencyMs: v.number(),
    totalCostUsd: v.number(),
    // Comparison metadata
    purpose: v.optional(v.string()), // Why this comparison was run
    tags: v.optional(v.array(v.string())),
    // Winner (if determined)
    winnerConfigId: v.optional(v.id("api_configs")),
    winnerReason: v.optional(v.string()), // "fastest", "cheapest", "best_quality"
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_batch_id", ["batchId"]),

  // Alerts and anomalies
  alerts: defineTable({
    timestamp: v.number(),
    severity: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical")
    ),
    type: v.string(), // "cost_spike", "latency_spike", "error_rate", "hallucination", etc.
    title: v.string(),
    description: v.string(),
    // Related entities
    apiConfigId: v.optional(v.id("api_configs")),
    metricId: v.optional(v.id("metrics")),
    inferenceId: v.optional(v.id("raw_inferences")),
    // Alert data
    threshold: v.optional(v.number()),
    actualValue: v.optional(v.number()),
    deviation: v.optional(v.number()), // How much it deviated from normal
    // Status
    acknowledged: v.boolean(),
    acknowledgedAt: v.optional(v.number()),
    acknowledgedBy: v.optional(v.string()),
    resolved: v.boolean(),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_severity", ["severity", "timestamp"])
    .index("by_type", ["type", "timestamp"])
    .index("by_status", ["resolved", "acknowledged", "timestamp"])
    .index("by_api_config", ["apiConfigId", "timestamp"]),

  // A/B test configurations
  ab_tests: defineTable({
    name: v.string(),
    description: v.string(),
    status: v.union(
      v.literal("draft"),
      v.literal("running"),
      v.literal("paused"),
      v.literal("completed")
    ),
    // Test configuration
    controlConfigId: v.id("api_configs"), // Baseline
    variantConfigIds: v.array(v.id("api_configs")), // Variants to test
    testPrompts: v.array(v.string()), // Prompts to use for testing
    // Test parameters
    sampleSize: v.number(), // How many inferences per config
    successCriteria: v.string(), // What defines success
    // Results
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    winnerConfigId: v.optional(v.id("api_configs")),
    results: v.optional(v.any()), // Detailed results JSON
    // Metadata
    createdAt: v.number(),
    createdBy: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),
});
