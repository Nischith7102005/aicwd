import { query, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get session by sessionId
 */
export const getSession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", q => q.eq("sessionId", args.sessionId))
      .first();
  },
});

/**
 * Get active sessions
 */
export const getActiveSessions = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    return await ctx.db
      .query("sessions")
      .withIndex("by_status", q => q.eq("status", "active"))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get sessions by status
 */
export const getSessionsByStatus = query({
  args: { 
    status: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    return await ctx.db
      .query("sessions")
      .withIndex("by_status", q => q.eq("status", args.status))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get sessions requiring attention (flagged or high risk)
 */
export const getSessionsRequiringAttention = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    
    const flagged = await ctx.db
      .query("sessions")
      .withIndex("by_status", q => q.eq("status", "flagged"))
      .take(limit);
    
    // Get high risk sessions
    const allActive = await ctx.db
      .query("sessions")
      .withIndex("by_status", q => q.eq("status", "active"))
      .collect();
    
    const highRisk = allActive
      .filter(s => s.cumulativeRisk > 0.5)
      .slice(0, limit - flagged.length);
    
    return [...flagged, ...highRisk];
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY EVENT QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get security events for a session
 */
export const getSessionSecurityEvents = query({
  args: { 
    sessionId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("securityEvents")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get recent security events (all sessions)
 */
export const getRecentSecurityEvents = query({
  args: { 
    limit: v.optional(v.number()),
    severity: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    
    if (args.severity) {
      return await ctx.db
        .query("securityEvents")
        .withIndex("by_severity", q => q.eq("severity", args.severity!))
        .order("desc")
        .take(limit);
    }
    
    return await ctx.db
      .query("securityEvents")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});

/**
 * Get security events by type
 */
export const getSecurityEventsByType = query({
  args: { 
    eventType: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("securityEvents")
      .withIndex("by_type", q => q.eq("eventType", args.eventType))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get unresolved security events
 */
export const getUnresolvedSecurityEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const all = await ctx.db
      .query("securityEvents")
      .order("desc")
      .take(limit * 2);
    
    return all.filter(e => !e.resolved).slice(0, limit);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRI QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get CRI records for a session
 */
export const getSessionCRIRecords = query({
  args: { 
    sessionId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    return await ctx.db
      .query("cognitiveRiskIndex")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get CRI records by level
 */
export const getCRIRecordsByLevel = query({
  args: { 
    criLevel: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("cognitiveRiskIndex")
      .withIndex("by_criLevel", q => q.eq("criLevel", args.criLevel))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get recent CRI history (all sessions)
 */
export const getRecentCRIHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    return await ctx.db
      .query("cognitiveRiskIndex")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// INJECTION PATTERN QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get injection patterns for a session
 */
export const getSessionInjectionPatterns = query({
  args: { 
    sessionId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("injectionPatterns")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get injection patterns by type
 */
export const getInjectionPatternsByType = query({
  args: { 
    patternType: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("injectionPatterns")
      .withIndex("by_type", q => q.eq("patternType", args.patternType))
      .order("desc")
      .take(limit);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY INDICATORS QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get security indicators for a session
 */
export const getSessionSecurityIndicators = query({
  args: { 
    sessionId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("securityIndicators")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(limit);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOG QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get audit log for a session
 */
export const getSessionAuditLog = query({
  args: { 
    sessionId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    return await ctx.db
      .query("auditLog")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get audit log by action type
 */
export const getAuditLogByAction = query({
  args: { 
    action: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("auditLog")
      .withIndex("by_action", q => q.eq("action", args.action))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get recent audit log (all sessions)
 */
export const getRecentAuditLog = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    return await ctx.db
      .query("auditLog")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// ZERO TRUST DECISION QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get zero trust decisions for a session
 */
export const getSessionZeroTrustDecisions = query({
  args: { 
    sessionId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("zeroTrustDecisions")
      .withIndex("by_session", q => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(limit);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD / AGGREGATE QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get dashboard summary stats
 */
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const hourAgo = now - 60 * 60 * 1000;
    
    // Active sessions
    const activeSessions = await ctx.db
      .query("sessions")
      .withIndex("by_status", q => q.eq("status", "active"))
      .collect();
    
    // Recent security events
    const recentEvents = await ctx.db
      .query("securityEvents")
      .withIndex("by_timestamp")
      .filter(q => q.gte(q.field("timestamp"), hourAgo))
      .collect();
    
    // Critical events
    const criticalEvents = recentEvents.filter(e => e.severity === "critical");
    
    // High risk sessions
    const highRiskSessions = activeSessions.filter(s => s.cumulativeRisk > 0.5);
    
    // Recent CRI average
    const recentCRI = await ctx.db
      .query("cognitiveRiskIndex")
      .withIndex("by_timestamp")
      .filter(q => q.gte(q.field("timestamp"), hourAgo))
      .collect();
    
    const avgCRI = recentCRI.length > 0
      ? recentCRI.reduce((a, r) => a + r.cri, 0) / recentCRI.length
      : 0;
    
    return {
      activeSessions: activeSessions.length,
      highRiskSessions: highRiskSessions.length,
      recentEvents: recentEvents.length,
      criticalEvents: criticalEvents.length,
      averageCRI: avgCRI,
      timestamp: now,
    };
  },
});

/**
 * Get CRI distribution for charts
 */
export const getCRIDistribution = query({
  args: { 
    sessionId: v.optional(v.string()),
    hours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hours = args.hours || 24;
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    
    let records;
    if (args.sessionId) {
      records = await ctx.db
        .query("cognitiveRiskIndex")
        .withIndex("by_session", q => q.eq("sessionId", args.sessionId!))
        .filter(q => q.gte(q.field("timestamp"), cutoff))
        .collect();
    } else {
      records = await ctx.db
        .query("cognitiveRiskIndex")
        .withIndex("by_timestamp")
        .filter(q => q.gte(q.field("timestamp"), cutoff))
        .collect();
    }
    
    // Group by hour
    const hourlyBuckets: Record<number, { count: number; criSum: number }> = {};
    
    for (const record of records) {
      const hour = Math.floor(record.timestamp / (60 * 60 * 1000));
      if (!hourlyBuckets[hour]) {
        hourlyBuckets[hour] = { count: 0, criSum: 0 };
      }
      hourlyBuckets[hour].count++;
      hourlyBuckets[hour].criSum += record.cri;
    }
    
    return Object.entries(hourlyBuckets).map(([hour, data]) => ({
      timestamp: parseInt(hour) * 60 * 60 * 1000,
      avgCRI: data.criSum / data.count,
      count: data.count,
    })).sort((a, b) => a.timestamp - b.timestamp);
  },
});

/**
 * Get injection pattern statistics
 */
export const getInjectionPatternStats = query({
  args: { hours: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const hours = args.hours || 24;
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    
    const patterns = await ctx.db
      .query("injectionPatterns")
      .withIndex("by_timestamp")
      .filter(q => q.gte(q.field("timestamp"), cutoff))
      .collect();
    
    const stats: Record<string, { count: number; avgRisk: number; blocked: number }> = {};
    
    for (const pattern of patterns) {
      if (!stats[pattern.patternType]) {
        stats[pattern.patternType] = { count: 0, avgRisk: 0, blocked: 0 };
      }
      stats[pattern.patternType].count++;
      stats[pattern.patternType].avgRisk += pattern.riskScore;
      if (pattern.blocked) stats[pattern.patternType].blocked++;
    }
    
    return Object.entries(stats).map(([type, data]) => ({
      patternType: type,
      count: data.count,
      avgRisk: data.avgRisk / data.count,
      blocked: data.blocked,
    })).sort((a, b) => b.count - a.count);
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXISTING QUERIES (preserved for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

export const getMetricsHistory = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("metrics")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit)
      .then((rows) => rows.reverse());
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

export const getRecentLogsForExport = internalQuery({
  args: { cutoffTime: v.number() },
  handler: async (ctx, args) => {
    try {
      const rawLogs = await ctx.db
        .query("raw_logs")
        .filter((q) => q.gte(q.field("timestamp"), args.cutoffTime))
        .collect();
      if (rawLogs.length > 0) return rawLogs;
    } catch { /* table might not exist */ }
    
    try {
      const inferences = await ctx.db
        .query("raw_inferences")
        .filter((q) => q.gte(q.field("timestamp"), args.cutoffTime))
        .collect();
      if (inferences.length > 0) return inferences;
    } catch { /* table might not exist */ }
    
    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_timestamp")
      .filter((q) => q.gte(q.field("timestamp"), args.cutoffTime))
      .collect();
    
    return metrics.map((m) => ({
      ...m,
      prompt: "",
      response: "",
      latencyMs: m.latencyMs || 0,
    }));
  },
});
