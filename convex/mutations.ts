import { mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION MANAGEMENT MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a new monitoring session
 */
export const createSession = mutation({
  args: {
    sessionId: v.string(),
    userId: v.optional(v.string()),
    provider: v.string(),
    model: v.string(),
    configId: v.optional(v.id("apiConfigs")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Check if session already exists
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", q => q.eq("sessionId", args.sessionId))
      .first();
    
    if (existing) {
      // Update existing session
      await ctx.db.patch(existing._id, {
        lastActivity: now,
        status: "active",
      });
      return existing;
    }
    
    // Create new session
    return await ctx.db.insert("sessions", {
      sessionId: args.sessionId,
      userId: args.userId,
      provider: args.provider,
      model: args.model,
      startTime: now,
      lastActivity: now,
      status: "active",
      trustLevel: "full",
      cumulativeRisk: 0,
      interactionCount: 0,
      flags: [],
      configId: args.configId,
    });
  },
});

/**
 * Update session status
 */
export const updateSessionStatus = mutation({
  args: {
    sessionId: v.string(),
    status: v.optional(v.string()),
    cumulativeRisk: v.optional(v.number()),
    flag: v.optional(v.string()),
    trustLevel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", q => q.eq("sessionId", args.sessionId))
      .first();
    
    if (!session) {
      throw new Error(`Session not found: ${args.sessionId}`);
    }
    
    const updates: any = { lastActivity: Date.now() };
    
    if (args.status) updates.status = args.status;
    if (args.cumulativeRisk !== undefined) updates.cumulativeRisk = args.cumulativeRisk;
    if (args.trustLevel) updates.trustLevel = args.trustLevel;
    if (args.flag && !session.flags.includes(args.flag)) {
      updates.flags = [...session.flags, args.flag];
    }
    
    await ctx.db.patch(session._id, updates);
    return { success: true, ...updates };
  },
});

/**
 * Update session trust level
 */
export const updateTrustLevel = mutation({
  args: {
    sessionId: v.string(),
    newTrustLevel: v.string(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", q => q.eq("sessionId", args.sessionId))
      .first();
    
    if (!session) {
      throw new Error(`Session not found: ${args.sessionId}`);
    }
    
    const previousTrust = session.trustLevel;
    const previousRisk = session.cumulativeRisk;
    
    // Update session
    await ctx.db.patch(session._id, {
      trustLevel: args.newTrustLevel,
      lastActivity: Date.now(),
    });
    
    // Log the trust decision
    await ctx.db.insert("zeroTrustDecisions", {
      sessionId: args.sessionId,
      timestamp: Date.now(),
      trigger: args.reason,
      previousTrust,
      newTrust: args.newTrustLevel,
      previousRisk,
      newRisk: previousRisk, // Risk doesn't change from trust update
      enforcementAction: getEnforcementAction(args.newTrustLevel),
      automated: true,
      reason: args.reason,
    });
    
    return { success: true, previousTrust, newTrust: args.newTrustLevel };
  },
});

/**
 * Apply enforcement action
 */
export const applyEnforcement = mutation({
  args: {
    sessionId: v.string(),
    action: v.string(),
    trigger: v.string(),
    newRisk: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", q => q.eq("sessionId", args.sessionId))
      .first();
    
    if (!session) {
      throw new Error(`Session not found: ${args.sessionId}`);
    }
    
    const previousTrust = session.trustLevel;
    const newTrust = getTrustFromAction(args.action);
    
    // Update session
    await ctx.db.patch(session._id, {
      trustLevel: newTrust,
      status: args.action === "terminate" ? "terminated" : session.status,
      cumulativeRisk: args.newRisk,
      lastActivity: Date.now(),
    });
    
    // Log enforcement decision
    await ctx.db.insert("zeroTrustDecisions", {
      sessionId: args.sessionId,
      timestamp: Date.now(),
      trigger: args.trigger,
      previousTrust,
      newTrust,
      previousRisk: session.cumulativeRisk,
      newRisk: args.newRisk,
      enforcementAction: args.action,
      automated: true,
      reason: `Enforcement triggered: ${args.trigger}`,
    });
    
    return { success: true, action: args.action, newTrust };
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY EVENT MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Log a security event
 */
export const logSecurityEvent = mutation({
  args: {
    sessionId: v.string(),
    eventType: v.string(),
    severity: v.string(),
    source: v.string(),
    description: v.string(),
    rawInput: v.optional(v.string()),
    rawOutput: v.optional(v.string()),
    riskContribution: v.number(),
    mitigations: v.array(v.string()),
    metadata: v.optional(v.object({
      pattern: v.optional(v.string()),
      confidence: v.optional(v.number()),
      category: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const eventId = await ctx.db.insert("securityEvents", {
      sessionId: args.sessionId,
      timestamp: Date.now(),
      eventType: args.eventType,
      severity: args.severity,
      source: args.source,
      description: args.description,
      rawInput: args.rawInput,
      rawOutput: args.rawOutput,
      riskContribution: args.riskContribution,
      mitigations: args.mitigations,
      resolved: false,
      metadata: args.metadata,
    });
    
    // Also add to audit log
    await ctx.db.insert("auditLog", {
      timestamp: Date.now(),
      sessionId: args.sessionId,
      actor: "security_monitor",
      action: args.eventType,
      resource: "interaction",
      outcome: args.severity === "critical" ? "blocked" : "flagged",
      reason: args.description,
      metadata: args.metadata,
      criAtTime: args.riskContribution,
      trustLevelAtTime: "active",
    });
    
    return { eventId, logged: true };
  },
});

/**
 * Resolve a security event
 */
export const resolveSecurityEvent = mutation({
  args: {
    eventId: v.id("securityEvents"),
    resolvedBy: v.string(),
    resolution: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.eventId, {
      resolved: true,
    });
    
    // Log resolution in audit
    const event = await ctx.db.get(args.eventId);
    if (event) {
      await ctx.db.insert("auditLog", {
        timestamp: Date.now(),
        sessionId: event.sessionId,
        actor: args.resolvedBy,
        action: "resolve_event",
        resource: args.eventId,
        outcome: "success",
        reason: args.resolution,
        criAtTime: 0,
        trustLevelAtTime: "active",
      });
    }
    
    return { success: true };
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRI MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Save CRI record for an interaction
 */
export const saveCRI = mutation({
  args: {
    sessionId: v.string(),
    interactionId: v.string(),
    injectionRisk: v.number(),
    leakageRisk: v.number(),
    hallucinationRisk: v.number(),
    biasRisk: v.number(),
    anomalyRisk: v.number(),
    toolMisuseRisk: v.number(),
    cri: v.number(),
    criLevel: v.string(),
    action: v.string(),
    trustAdjustment: v.number(),
  },
  handler: async (ctx, args) => {
    // Get session to update
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", q => q.eq("sessionId", args.sessionId))
      .first();
    
    // Save CRI record (matching schema field names)
    const criId = await ctx.db.insert("cognitiveRiskIndex", {
      sessionId: args.sessionId,
      interactionId: args.interactionId,
      timestamp: Date.now(),
      injectionRisk: args.injectionRisk,
      leakageRisk: args.leakageRisk,
      hallucinationRisk: args.hallucinationRisk,
      biasRisk: args.biasRisk,
      anomalyRisk: args.anomalyRisk,
      toolMisuseRisk: args.toolMisuseRisk,
      cri: args.cri,
      criLevel: args.criLevel,
      prompt: "", // Will be updated by recordInteraction
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: 0,
      provider: session?.provider || "unknown",
      model: session?.model || "unknown",
      action: args.action,
      trustAdjustment: args.trustAdjustment,
    });
    
    // Update session cumulative risk
    if (session) {
      const newRisk = session.cumulativeRisk * 0.7 + args.cri * 0.3;
      await ctx.db.patch(session._id, {
        cumulativeRisk: newRisk,
        interactionCount: session.interactionCount + 1,
        lastActivity: Date.now(),
      });
    }
    
    return { criId, cri: args.cri, criLevel: args.criLevel };
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACTION RECORDING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Record a complete interaction with all telemetry data
 */
export const recordInteraction = mutation({
  args: {
    sessionId: v.string(),
    prompt: v.string(),
    response: v.optional(v.string()),
    inputTokens: v.number(),
    outputTokens: v.number(),
    latencyMs: v.number(),
    provider: v.string(),
    model: v.string(),
    category: v.string(),
    riskScores: v.object({
      injection: v.number(),
      leakage: v.number(),
      hallucination: v.number(),
      bias: v.number(),
      cri: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const interactionId = `int_${now}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Save to raw_logs
    await ctx.db.insert("raw_logs", {
      timestamp: now,
      prompt: args.prompt,
      response: args.response,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      latency: args.latencyMs,
      model: args.model,
      provider: args.provider,
      isAdversarial: true, // All cognitive tests are adversarial
      sessionId: args.sessionId,
    });
    
    // Save to metrics (for compatibility)
    const efficiencyRatio = args.inputTokens > 0 ? args.outputTokens / args.inputTokens : 0;
    const wasteIndex = Math.max(0, Math.min(1, 1 - efficiencyRatio));
    
    await ctx.db.insert("metrics", {
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      efficiencyRatio,
      wasteIndex,
      semanticDrift: args.riskScores.hallucination,
      hallucinationProb: args.riskScores.hallucination,
      censorshipScore: args.riskScores.leakage,
      biasScore: args.riskScores.bias,
      latencyMs: args.latencyMs,
      provider: args.provider,
      model: args.model,
      timestamp: now,
      sessionId: args.sessionId,
      cri: args.riskScores.cri,
      securityFlags: [args.category],
    });
    
    // Update session
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", q => q.eq("sessionId", args.sessionId))
      .first();
    
    if (session) {
      const newCumulativeRisk = session.cumulativeRisk * 0.7 + args.riskScores.cri * 0.3;
      await ctx.db.patch(session._id, {
        cumulativeRisk: newCumulativeRisk,
        interactionCount: session.interactionCount + 1,
        lastActivity: now,
      });
    }
    
    return { interactionId, cri: args.riskScores.cri };
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY INDICATORS MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Save security indicators for an interaction
 */
export const saveSecurityIndicators = mutation({
  args: {
    sessionId: v.string(),
    interactionId: v.string(),
    piiDetected: v.boolean(),
    piiTypes: v.array(v.string()),
    piiCount: v.number(),
    leakageDetected: v.boolean(),
    leakageTypes: v.array(v.string()),
    harmfulContent: v.boolean(),
    harmfulCategories: v.array(v.string()),
    violationDetected: v.boolean(),
    violationTypes: v.array(v.string()),
    riskScore: v.number(),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("securityIndicators", {
      sessionId: args.sessionId,
      interactionId: args.interactionId,
      timestamp: Date.now(),
      piiDetected: args.piiDetected,
      piiTypes: args.piiTypes,
      piiCount: args.piiCount,
      leakageDetected: args.leakageDetected,
      leakageTypes: args.leakageTypes,
      harmfulContent: args.harmfulContent,
      harmfulCategories: args.harmfulCategories,
      violationDetected: args.violationDetected,
      violationTypes: args.violationTypes,
      riskScore: args.riskScore,
      confidence: args.confidence,
    });
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// INJECTION PATTERN MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Save detected injection pattern
 */
export const saveInjectionPattern = mutation({
  args: {
    sessionId: v.string(),
    pattern: v.string(),
    patternType: v.string(),
    confidence: v.number(),
    rawPrompt: v.string(),
    matchedSegments: v.array(v.string()),
    riskScore: v.number(),
    blocked: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("injectionPatterns", {
      sessionId: args.sessionId,
      timestamp: Date.now(),
      pattern: args.pattern,
      patternType: args.patternType,
      confidence: args.confidence,
      rawPrompt: args.rawPrompt,
      matchedSegments: args.matchedSegments,
      riskScore: args.riskScore,
      blocked: args.blocked,
    });
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUDIT LOGGING MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Add audit log entry
 */
export const addAuditLog = mutation({
  args: {
    sessionId: v.string(),
    actor: v.string(),
    action: v.string(),
    resource: v.string(),
    outcome: v.string(),
    reason: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", q => q.eq("sessionId", args.sessionId))
      .first();
    
    return await ctx.db.insert("auditLog", {
      timestamp: Date.now(),
      sessionId: args.sessionId,
      actor: args.actor,
      action: args.action,
      resource: args.resource,
      outcome: args.outcome,
      reason: args.reason,
      metadata: args.metadata,
      criAtTime: session?.cumulativeRisk || 0,
      trustLevelAtTime: session?.trustLevel || "unknown",
    });
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXISTING MUTATIONS (preserved for backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════════

export const saveMetrics = mutation({
  args: {
    inputTokens: v.number(),
    outputTokens: v.number(),
    efficiencyRatio: v.number(),
    wasteIndex: v.number(),
    semanticDrift: v.number(),
    hallucinationProb: v.number(),
    censorshipScore: v.number(),
    biasScore: v.number(),
    latencyMs: v.number(),
    provider: v.string(),
    model: v.string(),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("metrics", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const addLog = mutation({
  args: {
    level: v.string(),
    message: v.string(),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("logs", {
      level: args.level,
      message: args.message,
      timestamp: Date.now(),
      sessionId: args.sessionId,
    });
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getEnforcementAction(trustLevel: string): string {
  switch (trustLevel) {
    case "full": return "none";
    case "restricted": return "restrict_tools";
    case "minimal": return "restrict_all";
    case "revoked": return "terminate";
    default: return "none";
  }
}

function getTrustFromAction(action: string): string {
  switch (action) {
    case "block":
    case "terminate":
      return "revoked";
    case "restrict":
      return "minimal";
    case "warn":
      return "restricted";
    default:
      return "full";
  }
}
