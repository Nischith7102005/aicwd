import { query } from "./_generated/server";
import { v } from "convex/values";

// ===========================
// API Config Queries
// ===========================

export const getApiConfigs = query({
  handler: async (ctx) => {
    return await ctx.db.query("api_configs").collect();
  },
});

export const getActiveApiConfigs = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("api_configs")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

export const getApiConfigById = query({
  args: { id: v.id("api_configs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getApiConfigsByProvider = query({
  args: { provider: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("api_configs")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .collect();
  },
});

// ===========================
// Metrics Queries
// ===========================

export const getLatestMetrics = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("metrics")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit || 10);
  },
});

export const getMetricsByApiConfig = query({
  args: {
    apiConfigId: v.id("api_configs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("metrics")
      .withIndex("by_api_config", (q) => q.eq("apiConfigId", args.apiConfigId))
      .order("desc")
      .take(args.limit || 100);
  },
});

export const getMetricsByModel = query({
  args: {
    targetModel: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("metrics")
      .withIndex("by_model", (q) => q.eq("targetModel", args.targetModel))
      .order("desc")
      .take(args.limit || 100);
  },
});

export const getMetricsByProvider = query({
  args: {
    provider: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("metrics")
      .withIndex("by_provider", (q) => q.eq("provider", args.provider))
      .order("desc")
      .take(args.limit || 100);
  },
});

export const getSuccessfulMetrics = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("metrics")
      .withIndex("by_success", (q) => q.eq("success", true))
      .order("desc")
      .take(args.limit || 100);
  },
});

export const getFailedMetrics = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("metrics")
      .withIndex("by_success", (q) => q.eq("success", false))
      .order("desc")
      .take(args.limit || 50);
  },
});

export const getMetricsByBatch = query({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("metrics")
      .withIndex("by_batch", (q) => q.eq("batchId", args.batchId))
      .collect();
  },
});

// ===========================
// Aggregate Statistics
// ===========================

export const getAggregateStats = query({
  args: {
    apiConfigId: v.optional(v.id("api_configs")),
    targetModel: v.optional(v.string()),
    provider: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let metrics = await ctx.db
      .query("metrics")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit || 500);

    // Apply filters
    if (args.apiConfigId) {
      metrics = metrics.filter((m) => m.apiConfigId === args.apiConfigId);
    }
    if (args.targetModel) {
      metrics = metrics.filter((m) => m.targetModel === args.targetModel);
    }
    if (args.provider) {
      metrics = metrics.filter((m) => m.provider === args.provider);
    }

    if (metrics.length === 0) {
      return {
        avgLatency: 0,
        avgTokensPerSecond: 0,
        avgCost: 0,
        avgInputTokens: 0,
        avgOutputTokens: 0,
        totalCost: 0,
        totalTokens: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        successRate: 0,
        avgEfficiencyRatio: 0,
        avgSemanticDrift: 0,
        avgWasteIndex: 0,
        avgHallucinationScore: 0,
        avgCoherenceScore: 0,
        avgRelevanceScore: 0,
        count: 0,
      };
    }

    const sum = metrics.reduce(
      (acc, m) => ({
        latency: acc.latency + m.latencyMs,
        tokensPerSecond: acc.tokensPerSecond + m.tokensPerSecond,
        cost: acc.cost + m.costUsd,
        inputTokens: acc.inputTokens + m.inputTokens,
        outputTokens: acc.outputTokens + m.outputTokens,
        totalTokens: acc.totalTokens + m.totalTokens,
        successes: acc.successes + (m.success ? 1 : 0),
        efficiencyRatio:
          acc.efficiencyRatio + (m.efficiencyRatio ?? 0),
        semanticDrift: acc.semanticDrift + (m.semanticDrift ?? 0),
        wasteIndex: acc.wasteIndex + (m.wasteIndex ?? 0),
        hallucinationScore:
          acc.hallucinationScore + (m.hallucinationScore ?? 0),
        coherenceScore: acc.coherenceScore + (m.coherenceScore ?? 0),
        relevanceScore: acc.relevanceScore + (m.relevanceScore ?? 0),
      }),
      {
        latency: 0,
        tokensPerSecond: 0,
        cost: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        successes: 0,
        efficiencyRatio: 0,
        semanticDrift: 0,
        wasteIndex: 0,
        hallucinationScore: 0,
        coherenceScore: 0,
        relevanceScore: 0,
      }
    );

    const n = metrics.length;
    return {
      avgLatency: sum.latency / n,
      avgTokensPerSecond: sum.tokensPerSecond / n,
      avgCost: sum.cost / n,
      avgInputTokens: sum.inputTokens / n,
      avgOutputTokens: sum.outputTokens / n,
      totalCost: sum.cost,
      totalTokens: sum.totalTokens,
      totalInputTokens: sum.inputTokens,
      totalOutputTokens: sum.outputTokens,
      successRate: (sum.successes / n) * 100,
      avgEfficiencyRatio: sum.efficiencyRatio / n,
      avgSemanticDrift: sum.semanticDrift / n,
      avgWasteIndex: sum.wasteIndex / n,
      avgHallucinationScore: sum.hallucinationScore / n,
      avgCoherenceScore: sum.coherenceScore / n,
      avgRelevanceScore: sum.relevanceScore / n,
      count: n,
    };
  },
});

export const getComparativeStats = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit || 500);

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
          latency: acc.latency + m.latencyMs,
          cost: acc.cost + m.costUsd,
          inputTokens: acc.inputTokens + m.inputTokens,
          outputTokens: acc.outputTokens + m.outputTokens,
          successes: acc.successes + (m.success ? 1 : 0),
          efficiencyRatio:
            acc.efficiencyRatio + (m.efficiencyRatio ?? 0),
          semanticDrift: acc.semanticDrift + (m.semanticDrift ?? 0),
          wasteIndex: acc.wasteIndex + (m.wasteIndex ?? 0),
          hallucinationScore:
            acc.hallucinationScore + (m.hallucinationScore ?? 0),
        }),
        {
          latency: 0,
          cost: 0,
          inputTokens: 0,
          outputTokens: 0,
          successes: 0,
          efficiencyRatio: 0,
          semanticDrift: 0,
          wasteIndex: 0,
          hallucinationScore: 0,
        }
      );

      return {
        model,
        provider: modelMetrics[0].provider,
        avgLatency: sum.latency / n,
        avgCost: sum.cost / n,
        totalCost: sum.cost,
        avgInputTokens: sum.inputTokens / n,
        avgOutputTokens: sum.outputTokens / n,
        successRate: (sum.successes / n) * 100,
        avgEfficiencyRatio: sum.efficiencyRatio / n,
        avgSemanticDrift: sum.semanticDrift / n,
        avgWasteIndex: sum.wasteIndex / n,
        avgHallucinationScore: sum.hallucinationScore / n,
        count: n,
      };
    });
  },
});

export const getCostAnalysis = query({
  args: {
    apiConfigId: v.optional(v.id("api_configs")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let metrics = await ctx.db
      .query("metrics")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit || 500);

    if (args.apiConfigId) {
      metrics = metrics.filter((m) => m.apiConfigId === args.apiConfigId);
    }

    const totalCost = metrics.reduce((sum, m) => sum + m.costUsd, 0);
    const totalInputCost = metrics.reduce((sum, m) => sum + m.inputCostUsd, 0);
    const totalOutputCost = metrics.reduce(
      (sum, m) => sum + m.outputCostUsd,
      0
    );
    const totalTokens = metrics.reduce((sum, m) => sum + m.totalTokens, 0);

    return {
      totalCost,
      totalInputCost,
      totalOutputCost,
      totalTokens,
      avgCostPerRequest: metrics.length > 0 ? totalCost / metrics.length : 0,
      avgCostPer1KTokens:
        totalTokens > 0 ? (totalCost / totalTokens) * 1000 : 0,
      requestCount: metrics.length,
    };
  },
});

// ===========================
// Logs Queries
// ===========================

export const getLogs = query({
  args: {
    limit: v.optional(v.number()),
    level: v.optional(
      v.union(
        v.literal("INFO"),
        v.literal("ALERT"),
        v.literal("DEBUG"),
        v.literal("WARN"),
        v.literal("ERROR")
      )
    ),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("logs").withIndex("by_timestamp").order("desc");

    const results = await query.take(args.limit || 100);

    let filtered = results;
    if (args.level) {
      filtered = filtered.filter((log) => log.level === args.level);
    }
    if (args.category) {
      filtered = filtered.filter((log) => log.category === args.category);
    }

    return filtered;
  },
});

export const getLogsByLevel = query({
  args: {
    level: v.union(
      v.literal("INFO"),
      v.literal("ALERT"),
      v.literal("DEBUG"),
      v.literal("WARN"),
      v.literal("ERROR")
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("logs")
      .withIndex("by_level", (q) => q.eq("level", args.level))
      .order("desc")
      .take(args.limit || 50);
  },
});

export const getLogsByCategory = query({
  args: {
    category: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("logs")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .order("desc")
      .take(args.limit || 50);
  },
});

export const getLogsByApiConfig = query({
  args: {
    apiConfigId: v.id("api_configs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("logs")
      .withIndex("by_api_config", (q) => q.eq("apiConfigId", args.apiConfigId))
      .order("desc")
      .take(args.limit || 50);
  },
});

// ===========================
// Raw Inferences Queries
// ===========================

export const getRawInferences = query({
  args: {
    limit: v.optional(v.number()),
    apiConfigId: v.optional(v.id("api_configs")),
    model: v.optional(v.string()),
    isAdversarial: v.optional(v.boolean()),
    success: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let results = await ctx.db
      .query("raw_inferences")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit || 100);

    if (args.apiConfigId !== undefined) {
      results = results.filter((i) => i.apiConfigId === args.apiConfigId);
    }
    if (args.model !== undefined) {
      results = results.filter((i) => i.model === args.model);
    }
    if (args.isAdversarial !== undefined) {
      results = results.filter((i) => i.isAdversarial === args.isAdversarial);
    }
    if (args.success !== undefined) {
      results = results.filter((i) => i.success === args.success);
    }

    return results;
  },
});

export const getRawInferenceById = query({
  args: { id: v.id("raw_inferences") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getAdversarialInferences = query({
  args: {
    limit: v.optional(v.number()),
    testType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let results = await ctx.db
      .query("raw_inferences")
      .withIndex("by_adversarial", (q) => q.eq("isAdversarial", true))
      .order("desc")
      .take(args.limit || 50);

    if (args.testType) {
      results = results.filter((i) => i.testType === args.testType);
    }

    return results;
  },
});

export const getRawInferencesByBatch = query({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("raw_inferences")
      .withIndex("by_batch", (q) => q.eq("batchId", args.batchId))
      .collect();
  },
});

export const getRawInferencesByUser = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("raw_inferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(args.limit || 50);
  },
});

// ===========================
// Batch Comparisons Queries
// ===========================

export const getBatchComparisons = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("batch_comparisons")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit || 50);
  },
});

export const getBatchComparisonById = query({
  args: { batchId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("batch_comparisons")
      .withIndex("by_batch_id", (q) => q.eq("batchId", args.batchId))
      .first();
  },
});

// ===========================
// Alerts Queries
// ===========================

export const getAlerts = query({
  args: {
    limit: v.optional(v.number()),
    severity: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("critical")
      )
    ),
    resolved: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let results = await ctx.db
      .query("alerts")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit || 100);

    if (args.severity) {
      results = results.filter((a) => a.severity === args.severity);
    }
    if (args.resolved !== undefined) {
      results = results.filter((a) => a.resolved === args.resolved);
    }

    return results;
  },
});

export const getUnresolvedAlerts = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("alerts")
      .withIndex("by_status", (q) =>
        q.eq("resolved", false).eq("acknowledged", false)
      )
      .order("desc")
      .take(args.limit || 50);
  },
});

export const getAlertsBySeverity = query({
  args: {
    severity: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical")
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("alerts")
      .withIndex("by_severity", (q) => q.eq("severity", args.severity))
      .order("desc")
      .take(args.limit || 50);
  },
});

export const getAlertsByType = query({
  args: {
    type: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("alerts")
      .withIndex("by_type", (q) => q.eq("type", args.type))
      .order("desc")
      .take(args.limit || 50);
  },
});

export const getAlertsByApiConfig = query({
  args: {
    apiConfigId: v.id("api_configs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("alerts")
      .withIndex("by_api_config", (q) => q.eq("apiConfigId", args.apiConfigId))
      .order("desc")
      .take(args.limit || 50);
  },
});

// ===========================
// A/B Tests Queries
// ===========================

export const getAbTests = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("running"),
        v.literal("paused"),
        v.literal("completed")
      )
    ),
  },
  handler: async (ctx, args) => {
    if (args.status) {
      return await ctx.db
        .query("ab_tests")
        .withIndex("by_status", (q) => q.eq("status", args.status))
        .collect();
    }
    return await ctx.db.query("ab_tests").collect();
  },
});

export const getAbTestById = query({
  args: { id: v.id("ab_tests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getRunningAbTests = query({
  handler: async (ctx) => {
    return await ctx.db
      .query("ab_tests")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();
  },
});

// ===========================
// Error Analysis
// ===========================

export const getRecentErrors = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("metrics")
      .withIndex("by_success", (q) => q.eq("success", false))
      .order("desc")
      .take(args.limit || 50);
  },
});

export const getErrorsByType = query({
  args: {
    errorType: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_success", (q) => q.eq("success", false))
      .order("desc")
      .take(args.limit || 100);

    return metrics.filter((m) => m.errorType === args.errorType);
  },
});

// ===========================
// Performance Queries
// ===========================

export const getLatencyStats = query({
  args: {
    apiConfigId: v.optional(v.id("api_configs")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let metrics = await ctx.db
      .query("metrics")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit || 500);

    if (args.apiConfigId) {
      metrics = metrics.filter((m) => m.apiConfigId === args.apiConfigId);
    }

    if (metrics.length === 0) {
      return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    const latencies = metrics.map((m) => m.latencyMs).sort((a, b) => a - b);
    const sum = latencies.reduce((a, b) => a + b, 0);

    return {
      min: latencies[0],
      max: latencies[latencies.length - 1],
      avg: sum / latencies.length,
      p50: latencies[Math.floor(latencies.length * 0.5)],
      p95: latencies[Math.floor(latencies.length * 0.95)],
      p99: latencies[Math.floor(latencies.length * 0.99)],
      count: latencies.length,
    };
  },
});

// ===========================
// Time-based Analytics
// ===========================

export const getMetricsByTimeRange = query({
  args: {
    startTime: v.number(),
    endTime: v.number(),
    apiConfigId: v.optional(v.id("api_configs")),
  },
  handler: async (ctx, args) => {
    let metrics = await ctx.db
      .query("metrics")
      .withIndex("by_timestamp")
      .order("desc")
      .collect();

    metrics = metrics.filter(
      (m) => m.timestamp >= args.startTime && m.timestamp <= args.endTime
    );

    if (args.apiConfigId) {
      metrics = metrics.filter((m) => m.apiConfigId === args.apiConfigId);
    }

    return metrics;
  },
});
