import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const getMetricsHistory = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("metrics")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit)
      .then((rows) => rows.reverse()); // chronological order
  },
});

export const getLogs = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("logs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit)
      .then((rows) => rows.reverse());
  },
});

/**
 * Internal query for ETL export - fetches recent metrics with all fields needed for export.
 * This query is used by the etlExport action to batch export data to the webhook.
 */
export const getRecentMetricsForExport = internalQuery({
  args: { cutoffTime: v.number() },
  handler: async (ctx, args) => {
    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_timestamp")
      .filter((q) => q.gte(q.field("timestamp"), args.cutoffTime))
      .collect();

    return metrics;
  },
});

/**
 * Get recent raw logs for export - combines metrics with raw log data if available.
 */
export const getRecentLogsForExport = internalQuery({
  args: { cutoffTime: v.number() },
  handler: async (ctx, args) => {
    // Try to get from raw_logs table first (from ingest.ts schema)
    try {
      const rawLogs = await ctx.db
        .query("raw_logs")
        .filter((q) => q.gte(q.field("timestamp"), args.cutoffTime))
        .collect();

      if (rawLogs.length > 0) {
        return rawLogs;
      }
    } catch {
      // raw_logs table might not exist in this schema variant
    }

    // Fall back to raw_inferences table (from metrics.ts schema)
    try {
      const inferences = await ctx.db
        .query("raw_inferences")
        .filter((q) => q.gte(q.field("timestamp"), args.cutoffTime))
        .collect();

      if (inferences.length > 0) {
        return inferences;
      }
    } catch {
      // raw_inferences table might not exist
    }

    // Final fallback: metrics table has most of the data we need
    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_timestamp")
      .filter((q) => q.gte(q.field("timestamp"), args.cutoffTime))
      .collect();

    return metrics.map((m) => ({
      ...m,
      prompt: "", // metrics don't have prompt by default
      response: "",
      latencyMs: m.latencyMs || 0,
    }));
  },
});
