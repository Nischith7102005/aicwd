import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ═══════════════════════════════════════════════════════════════════════
  // REAL-TIME TELEMETRY SCHEMA
  // ═══════════════════════════════════════════════════════════════════════

  // Active AI Sessions - tracks ongoing interactions
  sessions: defineTable({
    sessionId: v.string(),           // Unique session identifier
    userId: v.optional(v.string()),  // Optional user identifier
    provider: v.string(),            // LLM provider
    model: v.string(),               // Model being used
    startTime: v.number(),           // Session start timestamp
    lastActivity: v.number(),        // Last activity timestamp
    status: v.string(),              // "active" | "suspended" | "terminated" | "flagged"
    trustLevel: v.string(),          // "full" | "restricted" | "minimal" | "revoked"
    cumulativeRisk: v.number(),      // Running risk score (0-1)
    interactionCount: v.number(),    // Number of interactions in session
    flags: v.array(v.string()),      // Security flags raised
    configId: v.optional(v.id("apiConfigs")),
    // Additional fields for enhanced tracking
    totalInputTokens: v.optional(v.number()),
    totalOutputTokens: v.optional(v.number()),
    totalCost: v.optional(v.number()),
    averageCRI: v.optional(v.number()),
    peakCRI: v.optional(v.number()),
    createdAt: v.optional(v.number()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_status", ["status"])
    .index("by_lastActivity", ["lastActivity"]),

  // Security Events - every security-relevant event is logged
  securityEvents: defineTable({
    sessionId: v.string(),
    timestamp: v.number(),
    eventType: v.string(),           // "injection_attempt" | "pii_detected" | "data_leakage" | "hallucination" | "bias_detected" | "anomaly" | "threshold_breach"
    severity: v.string(),            // "low" | "medium" | "high" | "critical"
    source: v.string(),              // "input" | "output" | "behavior" | "system"
    description: v.string(),
    rawInput: v.optional(v.string()),
    rawOutput: v.optional(v.string()),
    riskContribution: v.number(),    // How much this event contributed to risk
    mitigations: v.array(v.string()),// Actions taken
    resolved: v.boolean(),
    metadata: v.optional(v.object({
      pattern: v.optional(v.string()),
      confidence: v.optional(v.number()),
      category: v.optional(v.string()),
    })),
  })
    .index("by_session", ["sessionId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_severity", ["severity"])
    .index("by_type", ["eventType"]),

  // Cognitive Risk Index - computed risk scores per interaction
  cognitiveRiskIndex: defineTable({
    sessionId: v.string(),
    interactionId: v.string(),
    timestamp: v.number(),
    // Individual risk components (0-1 each)
    injectionRisk: v.number(),
    leakageRisk: v.number(),
    hallucinationRisk: v.number(),
    biasRisk: v.number(),
    anomalyRisk: v.number(),
    toolMisuseRisk: v.number(),
    // Computed overall CRI
    cri: v.number(),                 // Cognitive Risk Index (weighted combination)
    criLevel: v.string(),            // "minimal" | "low" | "moderate" | "high" | "critical"
    // Context
    prompt: v.string(),
    response: v.optional(v.string()),
    inputTokens: v.number(),
    outputTokens: v.number(),
    latencyMs: v.number(),
    provider: v.string(),
    model: v.string(),
    // Decision
    action: v.string(),              // "allow" | "warn" | "restrict" | "block"
    trustAdjustment: v.number(),     // Change in trust level
  })
    .index("by_session", ["sessionId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_criLevel", ["criLevel"]),

  // Prompt Injection Patterns - detected attack patterns
  injectionPatterns: defineTable({
    sessionId: v.string(),
    timestamp: v.number(),
    pattern: v.string(),             // The detected pattern
    patternType: v.string(),         // "override" | "role_manipulation" | "jailbreak" | "data_exfiltration" | "instruction_injection"
    confidence: v.number(),
    rawPrompt: v.string(),
    matchedSegments: v.array(v.string()),
    riskScore: v.number(),
    blocked: v.boolean(),
  })
    .index("by_session", ["sessionId"])
    .index("by_type", ["patternType"])
    .index("by_timestamp", ["timestamp"]),

  // Security Indicators - structured signals extracted from outputs
  securityIndicators: defineTable({
    sessionId: v.string(),
    interactionId: v.string(),
    timestamp: v.number(),
    // PII Detection
    piiDetected: v.boolean(),
    piiTypes: v.array(v.string()),   // "ssn" | "email" | "phone" | "credit_card" | "address" | "name"
    piiCount: v.number(),
    // Data Leakage
    leakageDetected: v.boolean(),
    leakageTypes: v.array(v.string()), // "internal_ip" | "api_key" | "password" | "secret" | "internal_doc"
    // Content Safety
    harmfulContent: v.boolean(),
    harmfulCategories: v.array(v.string()),
    // Compliance
    violationDetected: v.boolean(),
    violationTypes: v.array(v.string()),
    // Raw scores
    riskScore: v.number(),
    confidence: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_timestamp", ["timestamp"]),

  // Audit Log - immutable compliance records
  auditLog: defineTable({
    timestamp: v.number(),
    sessionId: v.string(),
    actor: v.string(),               // Who/what initiated the action
    action: v.string(),              // What action was taken
    resource: v.string(),            // What was affected
    outcome: v.string(),             // "success" | "blocked" | "flagged" | "failed"
    reason: v.optional(v.string()),  // Why this action was taken
    metadata: v.optional(v.any()),   // Additional context
    criAtTime: v.number(),           // CRI at the time of this action
    trustLevelAtTime: v.string(),    // Trust level at the time
  })
    .index("by_session", ["sessionId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_action", ["action"]),

  // Zero Trust Decisions - enforcement actions taken
  zeroTrustDecisions: defineTable({
    sessionId: v.string(),
    timestamp: v.number(),
    trigger: v.string(),             // What triggered the decision
    previousTrust: v.string(),
    newTrust: v.string(),
    previousRisk: v.number(),
    newRisk: v.number(),
    enforcementAction: v.string(),   // "warn" | "restrict_tools" | "require_reauth" | "throttle" | "terminate"
    automated: v.boolean(),          // Was this automated or manual?
    reason: v.string(),
  })
    .index("by_session", ["sessionId"])
    .index("by_timestamp", ["timestamp"]),

  // ═══════════════════════════════════════════════════════════════════════
  // EXISTING TABLES (preserved for backward compatibility)
  // ═══════════════════════════════════════════════════════════════════════

  metrics: defineTable({
    inputTokens: v.number(),
    outputTokens: v.number(),
    efficiencyRatio: v.number(),
    wasteIndex: v.number(),
    semanticDrift: v.number(),
    hallucinationProb: v.optional(v.number()),
    censorshipScore: v.optional(v.number()),
    biasScore: v.optional(v.number()),
    latencyMs: v.optional(v.number()),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    targetModel: v.optional(v.string()),
    timestamp: v.number(),
    configId: v.optional(v.id("apiConfigs")),
    tokensPerSecond: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    success: v.optional(v.boolean()),
    error: v.optional(v.string()),
    // New fields for telemetry
    sessionId: v.optional(v.string()),
    cri: v.optional(v.number()),
    securityFlags: v.optional(v.array(v.string())),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_config", ["configId"])
    .index("by_session", ["sessionId"]),

  logs: defineTable({
    level: v.string(),
    message: v.string(),
    timestamp: v.number(),
    sessionId: v.optional(v.string()),
  }).index("by_timestamp", ["timestamp"]),

  apiConfigs: defineTable({
    provider: v.string(),
    apiKey: v.string(),
    model: v.string(),
    timestamp: v.number(),
    modelName: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
    inputPricePer1M: v.optional(v.number()),
    outputPricePer1M: v.optional(v.number()),
    name: v.optional(v.string()),
  }),

  raw_logs: defineTable({
    timestamp: v.number(),
    prompt: v.string(),
    response: v.optional(v.string()),
    inputTokens: v.number(),
    outputTokens: v.number(),
    latency: v.number(),
    model: v.string(),
    provider: v.string(),
    configId: v.optional(v.id("apiConfigs")),
    isAdversarial: v.boolean(),
    error: v.optional(v.string()),
    sessionId: v.optional(v.string()),
  }),

  batch_comparisons: defineTable({
    timestamp: v.number(),
    batchId: v.string(),
    prompt: v.string(),
    configIds: v.array(v.id("apiConfigs")),
    resultCount: v.number(),
  }),

  raw_inferences: defineTable({
    timestamp: v.number(),
    prompt: v.string(),
    response: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    model: v.string(),
    isAdversarial: v.boolean(),
    sessionId: v.optional(v.string()),
  }),
});
