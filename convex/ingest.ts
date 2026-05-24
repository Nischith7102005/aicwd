import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

export const logInference = mutation({
  args: { 
    prompt: v.string(), 
    configId: v.id("apiConfigs"),
    systemPrompt: v.optional(v.string()),
    temperature: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.configId);
    if (!config) {
      throw new Error("API config not found");
    }

    const timestamp = Date.now();

    try {
      // Call the actual LLM via the action
      const llmResponse = await ctx.scheduler.runAfter(0, api.llm.callLLM, {
        apiKey: config.apiKey,
        provider: config.provider,
        model: config.modelName || config.model,
        prompt: args.prompt,
      });

      if (!llmResponse.success) {
        // Log failed inference
        await ctx.db.insert("raw_logs", {
          timestamp,
          prompt: args.prompt,
          response: null,
          inputTokens: llmResponse.inputTokens || 0,
          outputTokens: 0,
          latency: llmResponse.latencyMs,
          model: config.modelName || config.model,
          provider: config.provider,
          configId: args.configId,
          isAdversarial: false,
          error: llmResponse.error,
        });

        // Log error metric
        await ctx.db.insert("metrics", {
          timestamp,
          configId: args.configId,
          inputTokens: llmResponse.inputTokens || 0,
          outputTokens: 0,
          latencyMs: llmResponse.latencyMs,
          tokensPerSecond: 0,
          costUsd: 0,
          success: false,
          error: llmResponse.error,
        });

        return { success: false, error: llmResponse.error };
      }

      // Calculate metrics
      const tokensPerSecond = (llmResponse.outputTokens || 0) / (llmResponse.latencyMs / 1000);
      
      // Calculate cost based on provider pricing (you'd want to store these in your config)
      const inputCost = (llmResponse.inputTokens || 0) * (config.inputPricePer1M || 0) / 1_000_000;
      const outputCost = (llmResponse.outputTokens || 0) * (config.outputPricePer1M || 0) / 1_000_000;
      const costUsd = inputCost + outputCost;

      // Calculate efficiency metrics
      const inputTokens = llmResponse.inputTokens || 0;
      const outputTokens = llmResponse.outputTokens || 0;
      const totalTokens = inputTokens + outputTokens;
      const outputRatio = totalTokens > 0 ? outputTokens / totalTokens : 0;

      // Calculate heuristic semantic drift based on response length variance
      const expectedLen = args.prompt.length * 3;
      const actualLen = (llmResponse.content || "").length;
      const semanticDrift = Math.min(
        1,
        Math.abs(actualLen - expectedLen) / (expectedLen || 1) * 0.3
      );

      // Calculate heuristic hallucination probability based on token ratios
      const hallucinationProb = Math.min(
        1,
        (1 - Math.min(outputTokens, inputTokens * 5) / (inputTokens * 5 || 1)) * 0.15
      );

      // Log the raw inference
      await ctx.db.insert("raw_logs", {
        timestamp,
        prompt: args.prompt,
        response: llmResponse.content || "",
        inputTokens,
        outputTokens,
        latency: llmResponse.latencyMs,
        model: config.modelName || config.model,
        provider: config.provider,
        configId: args.configId,
        isAdversarial: false,
        error: null,
      });

      // Log the metrics
      await ctx.db.insert("metrics", {
        timestamp,
        configId: args.configId,
        inputTokens,
        outputTokens,
        latencyMs: llmResponse.latencyMs,
        tokensPerSecond,
        costUsd,
        success: true,
        semanticDrift,
        hallucinationProb,
      });

      // Export to ETL pipeline for dbt transformation
      const efficiencyRatio = inputTokens > 0 ? outputTokens / inputTokens : 0;
      const wasteIndex = Math.max(0, Math.min(1, 1 - efficiencyRatio));
      
      await ctx.scheduler.runAfter(0, api.etlExport.exportInference, {
        timestamp,
        prompt: args.prompt,
        response: llmResponse.content || "",
        inputTokens,
        outputTokens,
        latency: llmResponse.latencyMs,
        model: config.modelName || config.model,
        provider: config.provider,
        configId: args.configId,
        isAdversarial: false,
        error: undefined,
        efficiencyRatio,
        wasteIndex,
        semanticDrift,
        hallucinationProb,
        tokensPerSecond,
        costUsd,
        success: true,
      });

      return { 
        success: true, 
        content: llmResponse.content,
        tokens: {
          input: inputTokens,
          output: outputTokens,
        },
        latency: llmResponse.latencyMs,
        cost: costUsd,
      };

    } catch (error: any) {
      console.error("Error logging inference:", error);
      return { success: false, error: error.message };
    }
  }
});

// Batch inference for comparing multiple models
export const logBatchInference = mutation({
  args: {
    prompt: v.string(),
    configIds: v.array(v.id("apiConfigs")),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const batchId = Math.random().toString(36).substring(7);
    const timestamp = Date.now();

    const results = await Promise.allSettled(
      args.configIds.map(async (configId) => {
        const config = await ctx.db.get(configId);
        if (!config) {
          return { success: false, error: "Config not found" };
        }

        // Call LLM action directly
        return ctx.scheduler.runAfter(0, api.llm.callLLM, {
          apiKey: config.apiKey,
          provider: config.provider,
          model: config.modelName || config.model,
          prompt: args.prompt,
        });
      })
    );

    // Store batch comparison
    await ctx.db.insert("batch_comparisons", {
      timestamp,
      batchId,
      prompt: args.prompt,
      configIds: args.configIds,
      resultCount: results.filter(r => r.status === "fulfilled" && (r.value as any).success).length,
    });

    return {
      batchId,
      results: results.map((result, index) => ({
        configId: args.configIds[index],
        success: result.status === "fulfilled" && (result.value as any).success,
        data: result.status === "fulfilled" ? result.value : null,
        error: result.status === "rejected" ? result.reason : null,
      })),
    };
  },
});

// Get latest metrics for a specific config
export const getLatestMetric = query({
  args: { configId: v.id("apiConfigs") },
  handler: async (ctx, args) => {
    const metric = await ctx.db
      .query("metrics")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .order("desc")
      .first();
    
    if (!metric) return null;

    const config = await ctx.db.get(args.configId);
    
    return {
      ...metric,
      config: config ? {
        provider: config.provider,
        model: config.modelName || config.model,
      } : null,
    };
  }
});

// Get recent logs across all configs
export const getRecentLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const logs = await ctx.db
      .query("raw_logs")
      .order("desc")
      .take(limit);
    
    // Enrich with config info
    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        const config = log.configId ? await ctx.db.get(log.configId) : null;
        return {
          ...log,
          configName: config?.name || config?.model || "Unknown",
          provider: log.provider || config?.provider || "Unknown",
        };
      })
    );

    return enrichedLogs.reverse();
  }
});

// Get metrics for a time range
export const getMetricsInRange = query({
  args: {
    configId: v.optional(v.id("apiConfigs")),
    startTime: v.number(),
    endTime: v.number(),
  },
  handler: async (ctx, args) => {
    let queryBuilder = ctx.db.query("metrics");

    if (args.configId) {
      queryBuilder = queryBuilder.withIndex("by_config", (q) => 
        q.eq("configId", args.configId)
      );
    }

    const allMetrics = await queryBuilder.collect();
    
    // Filter by time range
    const filteredMetrics = allMetrics.filter(
      m => m.timestamp >= args.startTime && m.timestamp <= args.endTime
    );

    return filteredMetrics;
  }
});

// Aggregate statistics for a config
export const getConfigStats = query({
  args: { configId: v.id("apiConfigs") },
  handler: async (ctx, args) => {
    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_config", (q) => q.eq("configId", args.configId))
      .collect();

    if (metrics.length === 0) {
      return {
        totalInferences: 0,
        successRate: 0,
        avgLatency: 0,
        avgTokensPerSecond: 0,
        totalCost: 0,
        totalTokens: 0,
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
      };
    }

    const successful = metrics.filter(m => m.success);
    
    const stats = {
      totalInferences: metrics.length,
      successRate: (successful.length / metrics.length) * 100,
      avgLatency: successful.reduce((sum, m) => sum + (m.latencyMs || 0), 0) / successful.length,
      avgTokensPerSecond: successful.reduce((sum, m) => sum + (m.tokensPerSecond || 0), 0) / successful.length,
      totalCost: metrics.reduce((sum, m) => sum + (m.costUsd || 0), 0),
      totalTokens: metrics.reduce((sum, m) => sum + m.inputTokens + m.outputTokens, 0),
      p50Latency: 0,
      p95Latency: 0,
      p99Latency: 0,
    };

    // Calculate latency percentiles
    const latencies = successful.map(m => m.latencyMs || 0).sort((a, b) => a - b);
    if (latencies.length > 0) {
      stats.p50Latency = latencies[Math.floor(latencies.length * 0.5)];
      stats.p95Latency = latencies[Math.floor(latencies.length * 0.95)];
      stats.p99Latency = latencies[Math.floor(latencies.length * 0.99)];
    }

    return stats;
  }
});

// Compare multiple configs side-by-side
export const compareConfigs = query({
  args: { 
    configIds: v.array(v.id("apiConfigs")),
    hours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hours = args.hours || 24;
    const startTime = Date.now() - (hours * 60 * 60 * 1000);

    const comparisons = await Promise.all(
      args.configIds.map(async (configId) => {
        const config = await ctx.db.get(configId);
        const recentMetrics = await ctx.db
          .query("metrics")
          .withIndex("by_config", (q) => q.eq("configId", configId))
          .filter((q) => q.gte(q.field("timestamp"), startTime))
          .collect();

        // Calculate stats inline since we can't call queries from queries
        const metrics = await ctx.db
          .query("metrics")
          .withIndex("by_config", (q) => q.eq("configId", configId))
          .collect();
        
        const successful = metrics.filter(m => m.success);
        const stats = {
          totalInferences: metrics.length,
          successRate: metrics.length > 0 ? (successful.length / metrics.length) * 100 : 0,
          avgLatency: successful.length > 0 
            ? successful.reduce((sum, m) => sum + (m.latencyMs || 0), 0) / successful.length 
            : 0,
        };

        return {
          configId,
          name: config?.name,
          provider: config?.provider,
          model: config?.modelName || config?.model,
          stats,
          recentInferences: recentMetrics.length,
        };
      })
    );

    return comparisons;
  }
});

// Get live dashboard data
export const getDashboardLive = query({
  handler: async (ctx) => {
    const recentMetrics = await ctx.db
      .query("metrics")
      .order("desc")
      .take(10);

    const last24h = Date.now() - (24 * 60 * 60 * 1000);
    const allMetrics = await ctx.db
      .query("metrics")
      .filter((q) => q.gte(q.field("timestamp"), last24h))
      .collect();

    const totalInferences = allMetrics.length;
    const successfulMetrics = allMetrics.filter(m => m.success);
    const successfulInferences = successfulMetrics.length;
    const totalCost = allMetrics.reduce((sum, m) => sum + (m.costUsd || 0), 0);
    const avgLatency = successfulInferences > 0
      ? successfulMetrics.reduce((sum, m) => sum + (m.latencyMs || 0), 0) / successfulInferences
      : 0;

    return {
      recentMetrics: recentMetrics.reverse(),
      summary: {
        totalInferences,
        successRate: totalInferences > 0 ? (successfulInferences / totalInferences) * 100 : 0,
        totalCost,
        avgLatency,
      },
    };
  }
});

