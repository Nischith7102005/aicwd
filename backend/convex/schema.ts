import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Raw LLM interaction logs
  logs: defineTable({
    doc_type: v.literal("log"),
    timestamp: v.number(),
    prompt: v.string(),
    response: v.string(),
    model: v.string(),
    prompt_tokens: v.number(),
    response_tokens: v.number(),
    total_tokens: v.number(),
    latency_ms: v.number(),
    metadata: v.optional(v.object({
      user_id: v.optional(v.string()),
      session_id: v.optional(v.string()),
      red_team_id: v.optional(v.string()),
      prompt_category: v.optional(v.string()),
      response_quality_score: v.optional(v.number()),
      refused: v.optional(v.boolean()),
    })),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_model", ["model"])
    .index("by_red_team", ["red_team_id"]),

  // Computed metrics from DBT transformations
  metrics: defineTable({
    doc_type: v.literal("metric"),
    timestamp: v.number(),
    metric_type: v.string(), // "token_efficiency", "semantic_drift", "adversarial_stress", "fragility_score"
    value: v.number(),
    log_id: v.id("logs"),
    metadata: v.optional(v.object({
      semantic_units: v.optional(v.number()),
      baseline_deviation: v.optional(v.number()),
      adversarial_prompt: v.optional(v.string()),
      coherence_score: v.optional(v.number()),
      hallucination_probability: v.optional(v.number()),
    })),
  })
    .index("by_timestamp_type", ["timestamp", "metric_type"])
    .index("by_type", ["metric_type"])
    .index("by_log", ["log_id"]),

  // Red-team execution records
  redTeamRuns: defineTable({
    doc_type: v.literal("red_team_run"),
    started_at: v.number(),
    completed_at: v.optional(v.number()),
    status: v.string(), // "running", "completed", "failed"
    total_prompts: v.number(),
    completed_prompts: v.number(),
    success_count: v.number(),
    refusal_count: v.number(),
    avg_latency_ms: v.optional(v.number()),
    total_tokens: v.optional(v.number()),
    avg_cognitive_waste: v.optional(v.number()),
    max_cognitive_waste: v.optional(v.number()),
    model_endpoint: v.string(),
  })
    .index("by_status", ["status"])
    .index("by_timestamp", ["started_at"]),

  // Adversarial prompt results
  adversarialResults: defineTable({
    doc_type: v.literal("adversarial_result"),
    red_team_run_id: v.id("redTeamRuns"),
    timestamp: v.number(),
    prompt_type: v.string(), // "jailbreak", "logic_puzzle", "semantic_overload", etc.
    adversarial_prompt: v.string(),
    groq_response: v.string(),
    response_tokens: v.number(),
    latency_ms: v.number(),
    refused: v.boolean(),
    cognitive_waste: v.number(),
    coherence_score: v.number(),
    hallucination_probability: v.number(),
    fragility_score: v.number(),
  })
    .index("by_run", ["red_team_run_id"])
    .index("by_timestamp", ["timestamp"])
    .index("by_type", ["prompt_type"]),

  // Baseline embeddings for semantic drift calculation
  baselineEmbeddings: defineTable({
    doc_type: v.literal("baseline_embedding"),
    prompt: v.string(),
    embedding: v.array(v.number()),
    category: v.string(),
    created_at: v.number(),
  })
    .index("by_category", ["category"]),

  // DBT run records
  dbtRuns: defineTable({
    doc_type: v.literal("dbt_run"),
    started_at: v.number(),
    completed_at: v.optional(v.number()),
    status: v.string(), // "running", "completed", "failed"
    models_run: v.number(),
    logs: v.string(),
    error: v.optional(v.string()),
  })
    .index("by_status", ["status"])
    .index("by_timestamp", ["started_at"]),
});
