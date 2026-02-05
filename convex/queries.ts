import { query } from "./_generated/server";
import { v } from "convex/values";

// API Config queries
export const getApiConfigs = query({
  handler: async (ctx) => {
    return await ctx.db.query("api_configs").collect();
  },
});

export const getActiveApiConfigs = query({
  handler: async (ctx) => {
    const configs = await ctx.db.query("api_configs").collect();
    return configs.filter(c => c.isActive);
  },
});

// Metrics queries
export const getLatestMetrics = query({
  handler: async (ctx) => {
    return await ctx.db.query("metrics").withIndex("by_timestamp").order("desc").first();
  },
});

export const getMetricsHistory = query({
  args: { 
    limit: v.optional(v.number()),
    apiConfigId: v.optional(v.id("api_configs")),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("metrics").withIndex("by_timestamp").order("desc");
    
    const results = await query.take(args.limit || 100);
    
    let filtered = results;
    if (args.apiConfigId) {
      filtered = filtered.filter(m => m.apiConfigId === args.apiConfigId);
    }
    if (args.model) {
      filtered = filtered.filter(m => m.targetModel === args.model);
    }
    
    return filtered.reverse();
  },
});

// Logs queries
export const getLogs = query({
  args: { 
    limit: v.optional(v.number()),
    level: v.optional(v.union(v.literal("INFO"), v.literal("ALERT"), v.literal("DEBUG"))),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("logs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit || 50);
    
    if (args.level) {
      return results.filter(log => log.level === args.level);
    }
    return results;
  },
});

// Raw inferences queries
export const getRawInferences = query({
  args: { 
    limit: v.optional(v.number()),
    apiConfigId: v.optional(v.id("api_configs")),
    isAdversarial: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("raw_inferences")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit || 50);
    
    let filtered = results;
    if (args.apiConfigId !== undefined) {
      filtered = filtered.filter(i => i.apiConfigId === args.apiConfigId);
    }
    if (args.isAdversarial !== undefined) {
      filtered = filtered.filter(i => i.isAdversarial === args.isAdversarial);
    }
    
    return filtered;
  },
});

// Aggregate stats
export const getAggregateStats = query({
  args: {
    apiConfigId: v.optional(v.id("api_configs")),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_timestamp")
      .order("desc")
      .take(200);

    let filtered = metrics;
    if (args.apiConfigId) {
      filtered = filtered.filter(m => m.apiConfigId === args.apiConfigId);
    }
    if (args.model) {
      filtered = filtered.filter(m => m.targetModel === args.model);
    }

    if (filtered.length === 0) {
      return { 
        avgDrift: 0, 
        avgWaste: 0, 
        avgHallucination: 0, 
        avgEfficiency: 0, 
        avgLatency: 0,
        totalTokens: 0,
        successRate: 0,
        count: 0 
      };
    }

    const sum = filtered.reduce(
      (acc, m) => ({
        drift: acc.drift + m.semanticDrift,
        waste: acc.waste + m.wasteIndex,
        hallucination: acc.hallucination + m.hallucinationProb,
        efficiency: acc.efficiency + m.efficiencyRatio,
        latency: acc.latency + m.latencyMs,
        tokens: acc.tokens + m.inputTokens + m.outputTokens,
        successes: acc.successes + (m.success ? 1 : 0),
      }),
      { drift: 0, waste: 0, hallucination: 0, efficiency: 0, latency: 0, tokens: 0, successes: 0 }
    );

    const n = filtered.length;
    return {
      avgDrift: sum.drift / n,
      avgWaste: sum.waste / n,
      avgHallucination: sum.hallucination / n,
      avgEfficiency: sum.efficiency / n,
      avgLatency: sum.latency / n,
      totalTokens: sum.tokens,
      successRate: (sum.successes / n) * 100,
      count: n,
    };
  },
});

// Comparison stats across all APIs/models
export const getComparativeStats = query({
  handler: async (ctx) => {
    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_timestamp")
      .order("desc")
      .take(300);

    // Group by model
    const byModel = metrics.reduce((acc, m) => {
      if (!acc[m.targetModel]) {
        acc[m.targetModel] = [];
      }
      acc[m.targetModel].push(m);
      return acc;
    }, {} as Record<string, typeof metrics>);

    // Calculate stats for each model
    return Object.entries(byModel).map(([model, modelMetrics]) => {
      const n = modelMetrics.length;
      const sum = modelMetrics.reduce(
        (acc, m) => ({
          drift: acc.drift + m.semanticDrift,
          waste: acc.waste + m.wasteIndex,
          hallucination: acc.hallucination + m.hallucinationProb,
          efficiency: acc.efficiency + m.efficiencyRatio,
          latency: acc.latency + m.latencyMs,
          successes: acc.successes + (m.success ? 1 : 0),
        }),
        { drift: 0, waste: 0, hallucination: 0, efficiency: 0, latency: 0, successes: 0 }
      );

      return {
        model,
        avgDrift: sum.drift / n,
        avgWaste: sum.waste / n,
        avgHallucination: sum.hallucination / n,
        avgEfficiency: sum.efficiency / n,
        avgLatency: sum.latency / n,
        successRate: (sum.successes / n) * 100,
        count: n,
      };
    });
  },
});

// Recent errors
export const getRecentErrors = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit || 100);
    
    return metrics.filter(m => !m.success).slice(0, args.limit || 20);
  },
});
