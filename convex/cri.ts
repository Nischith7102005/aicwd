import { action, internalAction, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

// ═══════════════════════════════════════════════════════════════════════════════
// COGNITIVE RISK INDEX (CRI) COMPUTATION ENGINE
// 
// CRI = Weighted combination of multiple risk factors that measures
// the overall cognitive security risk of an AI interaction or session.
//
// Like a credit score for AI safety - combines multiple indicators
// into a single actionable metric.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * CRI Configuration - Weights for each risk component
 */
const CRI_WEIGHTS = {
  // Primary risk factors (sum to 1.0)
  injectionRisk: 0.25,      // Prompt injection attempt detected
  leakageRisk: 0.20,        // Data leakage in output
  hallucinationRisk: 0.15,  // Hallucination indicators
  biasRisk: 0.10,           // Bias detected in response
  anomalyRisk: 0.15,        // Behavioral anomaly score
  toolMisuseRisk: 0.15,     // Tool/function misuse
};

/**
 * CRI Levels - Human-readable risk categories
 */
const CRI_LEVELS = {
  minimal: { min: 0, max: 0.15, label: "Minimal Risk", color: "#22c55e", action: "allow" },
  low: { min: 0.15, max: 0.35, label: "Low Risk", color: "#84cc16", action: "allow" },
  moderate: { min: 0.35, max: 0.55, label: "Moderate Risk", color: "#eab308", action: "warn" },
  high: { min: 0.55, max: 0.75, label: "High Risk", color: "#f97316", action: "restrict" },
  critical: { min: 0.75, max: 1.0, label: "Critical Risk", color: "#ef4444", action: "block" },
};

/**
 * Trust Level Thresholds
 */
const TRUST_THRESHOLDS = {
  full: { minRisk: 0, maxRisk: 0.25, description: "Full access - no restrictions" },
  restricted: { minRisk: 0.25, maxRisk: 0.50, description: "Restricted access - some features limited" },
  minimal: { minRisk: 0.50, maxRisk: 0.75, description: "Minimal access - significant limitations" },
  revoked: { minRisk: 0.75, maxRisk: 1.0, description: "Access revoked - session terminated" },
};

/**
 * Risk Escalation Rules
 */
const ESCALATION_RULES = {
  // Immediate escalation triggers
  immediateEscalation: [
    { pattern: "critical_pii", threshold: 0.8, action: "terminate" },
    { pattern: "multiple_injections", threshold: 3, action: "restrict" },
    { pattern: "confirmed_data_leak", threshold: 0.7, action: "terminate" },
  ],
  // Cumulative escalation
  cumulativeEscalation: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    thresholds: [
      { events: 3, riskSum: 1.5, action: "warn" },
      { events: 5, riskSum: 2.5, action: "restrict" },
      { events: 8, riskSum: 4.0, action: "terminate" },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN CRI CALCULATION ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate CRI for a single interaction
 */
export const calculateInteractionRisk = action({
  args: {
    sessionId: v.string(),
    interactionId: v.optional(v.string()),
    injectionRisk: v.number(),
    leakageRisk: v.number(),
    hallucinationRisk: v.number(),
    biasRisk: v.number(),
    anomalyRisk: v.number(),
    toolMisuseRisk: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Calculate weighted CRI
    const toolRisk = args.toolMisuseRisk || 0;
    
    const cri = 
      args.injectionRisk * CRI_WEIGHTS.injectionRisk +
      args.leakageRisk * CRI_WEIGHTS.leakageRisk +
      args.hallucinationRisk * CRI_WEIGHTS.hallucinationRisk +
      args.biasRisk * CRI_WEIGHTS.biasRisk +
      args.anomalyRisk * CRI_WEIGHTS.anomalyRisk +
      toolRisk * CRI_WEIGHTS.toolMisuseRisk;

    // Determine CRI level
    const criLevel = getCRILevel(cri);
    
    // Determine recommended action
    const action = getRecommendedAction(cri, criLevel);
    
    // Calculate trust adjustment (how much this affects session trust)
    const trustAdjustment = calculateTrustAdjustment(cri, criLevel);

    // Store the CRI record
    const interactionId = args.interactionId || `int_${Date.now()}`;
    await ctx.runMutation(api.mutations.saveCRI, {
      sessionId: args.sessionId,
      interactionId,
      injectionRisk: args.injectionRisk,
      leakageRisk: args.leakageRisk,
      hallucinationRisk: args.hallucinationRisk,
      biasRisk: args.biasRisk,
      anomalyRisk: args.anomalyRisk,
      toolMisuseRisk: toolRisk,
      cri,
      criLevel: criLevel.label,
      action,
      trustAdjustment,
    });

    return {
      cri,
      criLevel: criLevel.label,
      criColor: criLevel.color,
      action,
      trustAdjustment,
      breakdown: {
        injection: args.injectionRisk * CRI_WEIGHTS.injectionRisk,
        leakage: args.leakageRisk * CRI_WEIGHTS.leakageRisk,
        hallucination: args.hallucinationRisk * CRI_WEIGHTS.hallucinationRisk,
        bias: args.biasRisk * CRI_WEIGHTS.biasRisk,
        anomaly: args.anomalyRisk * CRI_WEIGHTS.anomalyRisk,
        toolMisuse: toolRisk * CRI_WEIGHTS.toolMisuseRisk,
      },
    };
  },
});

/**
 * Calculate session-level CRI (cumulative risk)
 */
export const calculateSessionCRI = action({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all CRI records for session
    const criRecords = await ctx.runQuery(api.queries.getSessionCRIRecords, {
      sessionId: args.sessionId,
      limit: 100,
    });

    if (criRecords.length === 0) {
      return {
        sessionCRI: 0,
        criLevel: "minimal",
        trend: "stable",
        recommendation: "Continue monitoring",
      };
    }

    // Calculate weighted average (recent interactions have more weight)
    const now = Date.now();
    let weightedSum = 0;
    let weightSum = 0;
    
    for (const record of criRecords) {
      const age = now - record.timestamp;
      const weight = Math.exp(-age / (30 * 60 * 1000)); // 30-minute decay
      weightedSum += record.cri * weight;
      weightSum += weight;
    }
    
    const sessionCRI = weightSum > 0 ? weightedSum / weightSum : 0;

    // Calculate trend
    const recentRecords = criRecords.slice(0, 5);
    const olderRecords = criRecords.slice(5, 10);
    
    let trend = "stable";
    if (recentRecords.length >= 3 && olderRecords.length >= 3) {
      const recentAvg = recentRecords.reduce((a, r) => a + r.cri, 0) / recentRecords.length;
      const olderAvg = olderRecords.reduce((a, r) => a + r.cri, 0) / olderRecords.length;
      
      if (recentAvg > olderAvg * 1.3) {
        trend = "increasing";
      } else if (recentAvg < olderAvg * 0.7) {
        trend = "decreasing";
      }
    }

    // Determine CRI level
    const criLevel = getCRILevel(sessionCRI);

    // Check escalation rules
    const escalation = checkEscalationRules(criRecords, sessionCRI);

    // Generate recommendation
    const recommendation = generateRecommendation(sessionCRI, trend, escalation);

    // Update session if needed
    if (escalation.action) {
      await ctx.runMutation(api.mutations.applyEnforcement, {
        sessionId: args.sessionId,
        action: escalation.action,
        trigger: escalation.trigger,
        newRisk: sessionCRI,
      });
    }

    return {
      sessionCRI,
      criLevel: criLevel.label,
      criColor: criLevel.color,
      trend,
      interactionCount: criRecords.length,
      escalation,
      recommendation,
      breakdown: {
        avgInjection: average(criRecords.map(r => r.injectionRisk)),
        avgLeakage: average(criRecords.map(r => r.leakageRisk)),
        avgHallucination: average(criRecords.map(r => r.hallucinationRisk)),
        avgBias: average(criRecords.map(r => r.biasRisk)),
        avgAnomaly: average(criRecords.map(r => r.anomalyRisk)),
      },
    };
  },
});

/**
 * Get session trust level info
 */
export const getSessionTrustLevel = action({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.runQuery(api.queries.getSession, {
      sessionId: args.sessionId,
    });

    if (!session) {
      return { trustLevel: "full", description: "Session not found - defaulting to full" };
    }

    const criResult = await ctx.runAction(api.cri.calculateSessionCRI, {
      sessionId: args.sessionId,
    });

    const trustLevel = getTrustLevel(criResult.sessionCRI);
    const threshold = TRUST_THRESHOLDS[trustLevel as keyof typeof TRUST_THRESHOLDS];

    return {
      trustLevel,
      description: threshold.description,
      sessionCRI: criResult.sessionCRI,
      criLevel: criResult.criLevel,
      allowedActions: getAllowedActions(trustLevel),
      restrictions: getRestrictions(trustLevel),
    };
  },
});

/**
 * Real-time CRI monitoring - should be called on every interaction
 */
export const monitorCRI = action({
  args: {
    sessionId: v.string(),
    currentCRI: v.number(),
    eventType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.runQuery(api.queries.getSession, {
      sessionId: args.sessionId,
    });

    if (!session) {
      return { action: "error", message: "Session not found" };
    }

    // Get recent events for escalation check
    const recentEvents = await ctx.runQuery(api.queries.getRecentSecurityEvents, {
      sessionId: args.sessionId,
      limit: 10,
    });

    // Check for immediate escalation triggers
    const criticalEvents = recentEvents.filter(e => e.severity === "critical");
    if (criticalEvents.length > 0 && args.currentCRI > 0.7) {
      // Immediate termination required
      await ctx.runMutation(api.mutations.updateSessionStatus, {
        sessionId: args.sessionId,
        status: "terminated",
        cumulativeRisk: args.currentCRI,
        flag: "critical_threshold_exceeded",
      });

      return {
        action: "terminate",
        reason: "Critical risk threshold exceeded",
        requiresReauth: false,
      };
    }

    // Check cumulative escalation
    const windowStart = Date.now() - ESCALATION_RULES.cumulativeEscalation.windowMs;
    const windowEvents = recentEvents.filter(e => e.timestamp >= windowStart);
    const riskSum = windowEvents.reduce((a, e) => a + e.riskContribution, 0);

    for (const threshold of ESCALATION_RULES.cumulativeEscalation.thresholds) {
      if (windowEvents.length >= threshold.events && riskSum >= threshold.riskSum) {
        if (threshold.action === "terminate") {
          await ctx.runMutation(api.mutations.updateSessionStatus, {
            sessionId: args.sessionId,
            status: "terminated",
            cumulativeRisk: args.currentCRI,
            flag: "cumulative_escalation",
          });

          return {
            action: "terminate",
            reason: `Cumulative risk escalation: ${windowEvents.length} events, risk sum: ${riskSum.toFixed(2)}`,
            requiresReauth: false,
          };
        } else if (threshold.action === "restrict") {
          await ctx.runMutation(api.mutations.updateTrustLevel, {
            sessionId: args.sessionId,
            newTrustLevel: "minimal",
            reason: "Cumulative escalation triggered",
          });

          return {
            action: "restrict",
            reason: `Restricting access due to cumulative risk`,
            requiresReauth: true,
          };
        } else if (threshold.action === "warn") {
          return {
            action: "warn",
            reason: `Elevated risk pattern detected`,
            requiresReauth: false,
          };
        }
      }
    }

    // No escalation needed
    const trustLevel = getTrustLevel(args.currentCRI);
    
    // Update session trust level if changed
    if (session.trustLevel !== trustLevel) {
      await ctx.runMutation(api.mutations.updateTrustLevel, {
        sessionId: args.sessionId,
        newTrustLevel: trustLevel,
        reason: "CRI threshold change",
      });
    }

    return {
      action: "continue",
      trustLevel,
      cumulativeRisk: args.currentCRI,
      recentEventCount: windowEvents.length,
    };
  },
});

/**
 * Get CRI configuration (for dashboard display)
 */
export const getCRIConfig = action({
  args: {},
  handler: async () => {
    return {
      weights: CRI_WEIGHTS,
      levels: CRI_LEVELS,
      trustThresholds: TRUST_THRESHOLDS,
      escalationRules: ESCALATION_RULES,
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getCRILevel(cri: number): { label: string; color: string; action: string; min: number; max: number } {
  for (const [label, config] of Object.entries(CRI_LEVELS)) {
    if (cri >= config.min && cri < config.max) {
      return { label, ...config };
    }
  }
  return { label: "critical", ...CRI_LEVELS.critical };
}

function getTrustLevel(cri: number): string {
  for (const [level, config] of Object.entries(TRUST_THRESHOLDS)) {
    if (cri >= config.minRisk && cri < config.maxRisk) {
      return level;
    }
  }
  return "revoked";
}

function getRecommendedAction(cri: number, criLevel: { action: string }): string {
  // Additional logic beyond just CRI level
  if (cri > 0.9) return "block";
  if (cri > 0.7) return "restrict";
  if (cri > 0.5) return "warn";
  return "allow";
}

function calculateTrustAdjustment(cri: number, criLevel: { label: string }): number {
  // How much this interaction should affect session trust
  if (criLevel.label === "critical") return 0.25;
  if (criLevel.label === "high") return 0.15;
  if (criLevel.label === "moderate") return 0.08;
  if (criLevel.label === "low") return 0.03;
  return 0;
}

function checkEscalationRules(records: any[], currentCRI: number): { action: string | null; trigger: string } {
  // Check for immediate escalation patterns
  const criticalCount = records.filter(r => r.cri > 0.75).length;
  if (criticalCount >= 2) {
    return { action: "restrict", trigger: "multiple_critical_interactions" };
  }

  // Check for escalating pattern
  if (records.length >= 3) {
    const recent = records.slice(0, 3);
    const isEscalating = recent.every((r, i) => 
      i === 0 || r.cri >= recent[i - 1].cri * 0.9
    );
    if (isEscalating && recent[0].cri > 0.5) {
      return { action: "warn", trigger: "escalating_risk_pattern" };
    }
  }

  return { action: null, trigger: "none" };
}

function generateRecommendation(cri: number, trend: string, escalation: { action: string | null }): string {
  if (escalation.action === "terminate") {
    return "Session should be terminated immediately due to critical risk levels.";
  }
  if (escalation.action === "restrict") {
    return "Restrict session access and consider requiring re-authentication.";
  }
  if (trend === "increasing" && cri > 0.4) {
    return "Risk is trending upward. Consider proactive intervention.";
  }
  if (trend === "decreasing") {
    return "Risk is decreasing. Continue current monitoring approach.";
  }
  if (cri < 0.35) {
    return "Session is operating within acceptable risk parameters.";
  }
  return "Monitor session closely for risk escalation.";
}

function getAllowedActions(trustLevel: string): string[] {
  switch (trustLevel) {
    case "full":
      return ["chat", "tools", "files", "external_apis", "admin"];
    case "restricted":
      return ["chat", "tools", "files"];
    case "minimal":
      return ["chat"];
    case "revoked":
      return [];
    default:
      return ["chat"];
  }
}

function getRestrictions(trustLevel: string): string[] {
  switch (trustLevel) {
    case "full":
      return [];
    case "restricted":
      return ["external_apis", "admin_actions"];
    case "minimal":
      return ["external_apis", "admin_actions", "tools", "file_operations", "extended_context"];
    case "revoked":
      return ["all_access_revoked"];
    default:
      return [];
  }
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
