import { query } from "./_generated/server";
import { v } from "convex/values";

export const getLatestMetrics = query({
  handler: async (ctx) => {
    return await ctx.db.query("metrics").withIndex("by_timestamp").order("desc").first();
  },
});

export const getMetricsHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("metrics")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit || 50);
    return results.reverse();
  },
});

export const getLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("logs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit || 20);
  },
});

export const getAggregateStats = query({
  handler: async (ctx) => {
    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_timestamp")
      .order("desc")
      .take(100);

    if (metrics.length === 0) {
      return { avgDrift: 0, avgWaste: 0, avgHallucination: 0, avgEfficiency: 0, count: 0 };
    }

    const sum = metrics.reduce(
      (acc, m) => ({
        drift: acc.drift + m.semanticDrift,
        waste: acc.waste + m.wasteIndex,
        hallucination: acc.hallucination + m.hallucinationProb,
        efficiency: acc.efficiency + m.efficiencyRatio,
      }),
      { drift: 0, waste: 0, hallucination: 0, efficiency: 0 }
    );

    const n = metrics.length;
    return {
      avgDrift: sum.drift / n,
      avgWaste: sum.waste / n,
      avgHallucination: sum.hallucination / n,
      avgEfficiency: sum.efficiency / n,
      count: n,
    };
  },
});
