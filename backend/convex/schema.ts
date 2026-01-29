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
  }).index("by_created_at", ["created_at"]),

  metrics: defineTable({
    token_efficiency: v.number(),
    semantic_drift: v.number(),
    waste_index: v.number(),
    adversarial_stress: v.number(),
    created_at: v.number(),
  }).index("by_created_at", ["created_at"]),

  red_team_runs: defineTable({
    status: v.string(), // "in-progress", "completed", "failed"
    start_time: v.number(),
    end_time: v.optional(v.number()),
    adversarial_prompts_count: v.number(),
    fragility_score: v.optional(v.number()),
  }).index("by_start_time", ["start_time"]),

  red_team_results: defineTable({
    run_id: v.id("red_team_runs"),
    prompt: v.string(),
    response: v.string(),
    latency_delta: v.number(),
    coherence_drop: v.number(),
    waste_acceleration: v.number(),
    created_at: v.number(),
  }).index("by_run_id", ["run_id"]),
});
