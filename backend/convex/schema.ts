import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  logs: defineTable({
    prompt: v.string(),
    response: v.string(),
    tokens: v.number(),
    latency: v.number(),
    model: v.string(),
    created_at: v.number(),
  })
    .index("by_created_at", ["created_at"])
    .index("by_model", ["model", "created_at"]),

  metrics: defineTable({
    token_efficiency: v.number(),
    drift: v.number(),
    waste_index: v.number(),
    stress: v.number(),
    created_at: v.number(),

    log_id: v.optional(v.id("logs")),
    window_5s: v.optional(v.number()),
  })
    .index("by_created_at", ["created_at"])
    .index("by_log_id", ["log_id"]),

  red_team_runs: defineTable({
    status: v.string(),
    start_time: v.number(),
    end_time: v.optional(v.number()),

    total_prompts: v.number(),
    prompts_completed: v.number(),

    fragility_score: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_start_time", ["start_time"])
    .index("by_status", ["status", "start_time"]),

  red_team_results: defineTable({
    campaign_id: v.id("red_team_runs"),

    prompt: v.string(),
    response: v.string(),

    latency_delta: v.number(),
    coherence_drop: v.number(),
    waste_score: v.number(),

    created_at: v.number(),
  })
    .index("by_campaign_id", ["campaign_id", "created_at"])
    .index("by_waste_score", ["waste_score", "created_at"]),
});
