import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

// ═══════════════════════════════════════════════════════════════════════════════
// PROMPT INJECTION & ADVERSARIAL PATTERN DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Injection pattern categories and their detection rules
 * Each pattern has: regex patterns, severity, and risk contribution
 */
const INJECTION_PATTERNS = {
  // 1. INSTRUCTION OVERRIDE - Attempts to change system behavior
  instructionOverride: {
    patterns: [
      /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|prompts?|guidelines?)/gi,
      /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|prompts?)/gi,
      /forget\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?|prompts?)/gi,
      /override\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|rules?)/gi,
      /skip\s+(all\s+)?(previous|prior)\s+(instructions?|rules?)/gi,
      /neglect\s+(all\s+)?(previous|prior)\s+(instructions?|rules?)/gi,
      /pay\s+no\s+attention\s+to\s+(previous|prior|above)/gi,
      /do\s+not\s+(follow|obey|adhere\s+to)\s+(previous|prior|above)/gi,
      /your\s+(new|real|actual)\s+(instructions?|rules?|role)\s+(is|are|:)/gi,
      /override\s+your\s+(programming|instructions|guidelines)/gi,
    ],
    severity: "critical",
    riskContribution: 0.35,
    description: "Attempt to override system instructions",
  },

  // 2. ROLE MANIPULATION - Attempts to change AI's identity or role
  roleManipulation: {
    patterns: [
      /you\s+are\s+(now|no\s+longer)\s+(a\s+|an\s+)?(different|new|another)/gi,
      /pretend\s+(to\s+be|you're|you\s+are)\s+/gi,
      /act\s+(as\s+if\s+you\s+are|like\s+you're|as)\s+/gi,
      /role[\s-]*play\s+as\s+/gi,
      /simulate\s+(being|a|an)\s+/gi,
      /imagine\s+you\s+are\s+/gi,
      /from\s+now\s+on\s+(you're|you\s+are)\s+/gi,
      /adopt\s+the\s+(persona|character|role)\s+of/gi,
      /you're\s+(now|actually)\s+a\s+/gi,
      /you\s+have\s+been\s+(transformed|changed)\s+into/gi,
      /step\s+out\s+of\s+(your\s+)?character/gi,
      /break\s+(out\s+of\s+)?character/gi,
      /developer\s+mode/gi,
      /admin\s+mode/gi,
      /god\s+mode/gi,
      /sudo\s+mode/gi,
    ],
    severity: "high",
    riskContribution: 0.25,
    description: "Attempt to manipulate AI role or identity",
  },

  // 3. JAILBREAK ATTEMPTS - Common jailbreak patterns
  jailbreak: {
    patterns: [
      /DAN\s*(mode|prompt)?/gi,  // Do Anything Now
      /do\s+anything\s+now/gi,
      /anything\s+goes/gi,
      /no\s+(restrictions?|rules?|limits?|boundaries?)/gi,
      /unrestricted\s+(mode|access|ai)/gi,
      /unlimited\s+(mode|power|access)/gi,
      /free\s+(mode|access|from\s+rules)/gi,
      /uncensored\s+(mode|response|output)/gi,
      /bypass\s+(all\s+)?(filters?|rules?|restrictions?|safety)/gi,
      /circumvent\s+(all\s+)?(rules?|restrictions?|filters?)/gi,
      /escape\s+(your|the)\s+(rules?|restrictions?|programming)/gi,
      /break\s+(free|out|loose)\s+(from\s+)?(your\s+)?(rules?|restrictions?)/gi,
      /developer\s+override/gi,
      /system\s+override/gi,
      /admin\s+override/gi,
      /root\s+access/gi,
      /\[SYSTEM\]/gi,
      /\[ADMIN\]/gi,
      /\[DEVELOPER\]/gi,
      /\[OVERRIDE\]/gi,
      /<\|im_start\|>/gi,
      /<\|im_end\|>/gi,
    ],
    severity: "critical",
    riskContribution: 0.40,
    description: "Known jailbreak pattern detected",
  },

  // 4. DATA EXFILTRATION - Attempts to extract system information
  dataExfiltration: {
    patterns: [
      /reveal\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?)/gi,
      /show\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions?|rules?)/gi,
      /print\s+(your|the)\s+(system\s+)?(prompt|instructions?)/gi,
      /display\s+(your|the)\s+(system\s+)?(prompt|instructions?)/gi,
      /what\s+(are|is)\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?)/gi,
      /tell\s+me\s+(your|the)\s+(system\s+)?(prompt|instructions?|rules?)/gi,
      /repeat\s+(your|the)\s+(system\s+)?(prompt|instructions?|words?)/gi,
      /output\s+(your|the)\s+(system\s+)?(prompt|instructions?)/gi,
      /dump\s+(your|the)\s+(system\s+)?(prompt|memory|context)/gi,
      /leak\s+(your|the)\s+(system\s+)?(prompt|instructions?)/gi,
      /expose\s+(your|the)\s+(system\s+)?(prompt|instructions?)/gi,
      /share\s+(your|the)\s+(system\s+)?(prompt|instructions?)/gi,
      /(copy|paste|write\s+out)\s+(your|the)\s+(system\s+)?prompt/gi,
      /initial\s+(instructions?|prompt|configuration)/gi,
      /hidden\s+(instructions?|prompt|rules?)/gi,
      /secret\s+(instructions?|prompt|rules?)/gi,
    ],
    severity: "high",
    riskContribution: 0.30,
    description: "Attempt to extract system prompt or instructions",
  },

  // 5. INSTRUCTION INJECTION - Injecting new instructions
  instructionInjection: {
    patterns: [
      /SYSTEM\s*:\s*/gi,
      /ASSISTANT\s*:\s*/gi,
      /USER\s*:\s*/gi,
      /HUMAN\s*:\s*/gi,
      /AI\s*:\s*/gi,
      /\[INSTRUCTION\]/gi,
      /\[COMMAND\]/gi,
      /\[SYSTEM\s+MESSAGE\]/gi,
      /new\s+instruction\s*:/gi,
      /additional\s+instruction\s*:/gi,
      /supplementary\s+instruction\s*:/gi,
      /append\s+(this|the)\s+(to\s+your\s+)?(instructions?|prompt)/gi,
      /add\s+(this|the)\s+(to\s+your\s+)?(instructions?|prompt)/gi,
      /update\s+your\s+(instructions?|prompt)\s+(with|to)/gi,
      /modify\s+your\s+(instructions?|prompt)/gi,
      /change\s+your\s+(instructions?|prompt)/gi,
    ],
    severity: "high",
    riskContribution: 0.25,
    description: "Attempt to inject new instructions",
  },

  // 6. CONTEXT MANIPULATION - Attempts to confuse context
  contextManipulation: {
    patterns: [
      /this\s+is\s+(just\s+)?a\s+(test|game|simulation|exercise)/gi,
      /nothing\s+you\s+say\s+matters/gi,
      /in\s+(a\s+)?hypothetical\s+(world|scenario|situation)/gi,
      /in\s+(a\s+)?fictional\s+(world|scenario|story)/gi,
      /for\s+(research|educational|academic)\s+purposes/gi,
      /this\s+is\s+(safe|harmless|legal)/gi,
      /i\s+(have|got)\s+(permission|authorization)/gi,
      /my\s+(boss|manager|teacher|parent)\s+(said|told|wants)/gi,
      /security\s+(test|audit|check)/gi,
      /penetration\s+test/gi,
      /red\s+team\s+(test|exercise)/gi,
    ],
    severity: "medium",
    riskContribution: 0.15,
    description: "Attempt to manipulate context for bypass",
  },

  // 7. SOCIAL ENGINEERING - Manipulative language patterns
  socialEngineering: {
    patterns: [
      /please\s+(i\s+)?(beg|implore|beseech)\s+you/gi,
      /i\s+(really\s+|truly\s+|desperately\s+)?need\s+(this|your\s+help)/gi,
      /it's\s+(an\s+)?emergency/gi,
      /life\s+or\s+death/gi,
      /my\s+(life|job|career|family)\s+(depends|relies)\s+on\s+(this|you)/gi,
      /you're\s+(my\s+)?(only\s+)?(hope|chance)/gi,
      /i'll\s+(be\s+)?(fired|in\s+trouble|doomed)\s+if/gi,
      /no\s+one\s+will\s+(know|find\s+out|get\s+hurt)/gi,
      /just\s+this\s+once/gi,
      /nobody\s+is\s+(watching|looking|monitoring)/gi,
      /what\s+happens\s+if\s+someone/gi,  // Hypothetical harm probe
      /for\s+science/gi,
    ],
    severity: "medium",
    riskContribution: 0.12,
    description: "Social engineering manipulation attempt",
  },

  // 8. ENCODING/EMBEDDING - Attempts to hide malicious content
  encodingEmbedding: {
    patterns: [
      /\\u[0-9a-fA-F]{4}/g,  // Unicode escapes
      /\\x[0-9a-fA-F]{2}/g,  // Hex escapes
      /%[0-9a-fA-F]{2}/g,    // URL encoding
      /base64[a-zA-Z0-9+/=]+/gi,
      /atob\s*\(/gi,
      /btoa\s*\(/gi,
      /decode\s*\(/gi,
      /eval\s*\(/gi,
      /Function\s*\(/gi,
      /\{\{.*\}\}/g,  // Template injection
      /\$\{.*\}/g,    // Template literals
      /&#x?[0-9a-fA-F]+;/g,  // HTML entities
    ],
    severity: "high",
    riskContribution: 0.28,
    description: "Encoded or embedded content detected",
  },

  // 9. RECURSION/LOOP - Attempts to cause infinite loops
  recursionLoop: {
    patterns: [
      /repeat\s+(forever|indefinitely|endlessly)/gi,
      /never\s+stop\s+(repeating|saying|doing)/gi,
      /loop\s+(forever|indefinitely)/gi,
      /infinite\s+loop/gi,
      /recursive(\s+call)?/gi,
      /call\s+yourself\s+(again|repeatedly)/gi,
      /do\s+this\s+(again|repeatedly|forever)/gi,
    ],
    severity: "medium",
    riskContribution: 0.18,
    description: "Potential recursion or loop attack",
  },
};

/**
 * Analyze input for prompt injection patterns
 * Returns detected patterns, overall risk, and recommendations
 */
export const analyzeInput = action({
  args: {
    input: v.string(),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const input = args.input;
    const findings: Array<{
      category: string;
      severity: string;
      patterns: string[];
      riskContribution: number;
      description: string;
    }> = [];

    let totalRisk = 0;
    const matchedSegments: string[] = [];

    // Check each pattern category
    for (const [category, config] of Object.entries(INJECTION_PATTERNS)) {
      const matchedPatterns: string[] = [];
      
      for (const pattern of config.patterns) {
        const matches = input.match(pattern);
        if (matches) {
          matchedPatterns.push(...matches);
          matchedSegments.push(...matches);
        }
      }

      if (matchedPatterns.length > 0) {
        findings.push({
          category,
          severity: config.severity,
          patterns: [...new Set(matchedPatterns)], // Dedupe
          riskContribution: config.riskContribution,
          description: config.description,
        });
        totalRisk += config.riskContribution;
      }
    }

    // Cap total risk at 1.0
    totalRisk = Math.min(1, totalRisk);

    // Determine overall severity
    let overallSeverity = "low";
    if (findings.some(f => f.severity === "critical")) {
      overallSeverity = "critical";
    } else if (findings.some(f => f.severity === "high")) {
      overallSeverity = "high";
    } else if (findings.some(f => f.severity === "medium")) {
      overallSeverity = "medium";
    }

    // Determine recommended action
    let recommendedAction = "allow";
    if (totalRisk >= 0.7) {
      recommendedAction = "block";
    } else if (totalRisk >= 0.4) {
      recommendedAction = "restrict";
    } else if (totalRisk >= 0.2) {
      recommendedAction = "warn";
    }

    // Log security event if session provided and risk detected
    if (args.sessionId && findings.length > 0) {
      await ctx.runMutation(api.mutations.logSecurityEvent, {
        sessionId: args.sessionId,
        eventType: "injection_attempt",
        severity: overallSeverity,
        source: "input",
        description: `Detected ${findings.length} injection pattern(s): ${findings.map(f => f.category).join(", ")}`,
        rawInput: input,
        riskContribution: totalRisk,
        mitigations: recommendedAction === "block" ? ["blocked"] : 
                     recommendedAction === "restrict" ? ["flagged", "restricted"] : 
                     ["logged"],
        metadata: {
          pattern: findings.map(f => f.category).join(","),
          confidence: totalRisk,
        },
      });
    }

    return {
      isMalicious: totalRisk > 0.2,
      riskScore: totalRisk,
      severity: overallSeverity,
      recommendedAction,
      findings,
      matchedSegments: [...new Set(matchedSegments)],
      summary: findings.length > 0 
        ? `Detected ${findings.length} potential injection pattern(s) with ${overallSeverity} severity`
        : "No injection patterns detected",
    };
  },
});

/**
 * Quick check if input contains any injection patterns (lighter weight)
 */
export const quickInjectionCheck = internalAction({
  args: {
    input: v.string(),
  },
  handler: async (ctx, args) => {
    const input = args.input;
    
    // Check only the most critical patterns
    const criticalPatterns = [
      ...INJECTION_PATTERNS.instructionOverride.patterns,
      ...INJECTION_PATTERNS.jailbreak.patterns,
    ];

    for (const pattern of criticalPatterns) {
      if (pattern.test(input)) {
        return { hasInjection: true, requiresFullAnalysis: true };
      }
    }

    // Quick check for other patterns
    for (const [category, config] of Object.entries(INJECTION_PATTERNS)) {
      if (category === "instructionOverride" || category === "jailbreak") continue;
      
      for (const pattern of config.patterns) {
        if (pattern.test(input)) {
          return { hasInjection: true, requiresFullAnalysis: true };
        }
      }
    }

    return { hasInjection: false, requiresFullAnalysis: false };
  },
});

/**
 * Get injection pattern definitions (for documentation/debugging)
 */
export const getInjectionPatterns = action({
  args: {},
  handler: async () => {
    return Object.entries(INJECTION_PATTERNS).map(([category, config]) => ({
      category,
      severity: config.severity,
      riskContribution: config.riskContribution,
      description: config.description,
      patternCount: config.patterns.length,
    }));
  },
});

/**
 * Calculate behavioral anomaly score based on session history
 */
export const calculateAnomalyScore = action({
  args: {
    sessionId: v.string(),
    currentInput: v.string(),
    recentInputs: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Get session's security history
    const events = await ctx.runQuery(api.queries.getSessionSecurityEvents, {
      sessionId: args.sessionId,
      limit: 20,
    });

    let anomalyScore = 0;
    const factors: string[] = [];

    // Factor 1: Recent injection attempts
    const recentInjections = events.filter(e => e.eventType === "injection_attempt");
    if (recentInjections.length >= 3) {
      anomalyScore += 0.25;
      factors.push("Multiple recent injection attempts");
    } else if (recentInjections.length >= 1) {
      anomalyScore += 0.1;
      factors.push("Recent injection attempt");
    }

    // Factor 2: Input length anomaly (very long inputs can be suspicious)
    if (args.currentInput.length > 5000) {
      anomalyScore += 0.1;
      factors.push("Unusually long input");
    }

    // Factor 3: Repetitive patterns (might indicate automated attacks)
    if (args.recentInputs && args.recentInputs.length >= 3) {
      const similarities = args.recentInputs.slice(0, 3).map(prev => {
        return calculateSimilarity(args.currentInput, prev);
      });
      const avgSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;
      if (avgSimilarity > 0.8) {
        anomalyScore += 0.15;
        factors.push("Repetitive input pattern detected");
      }
    }

    // Factor 4: Escalating risk pattern
    const recentRisks = events.slice(0, 5).map(e => e.riskContribution);
    if (recentRisks.length >= 3) {
      const isEscalating = recentRisks.every((risk, i) => 
        i === 0 || risk >= recentRisks[i - 1] * 0.8
      );
      if (isEscalating && recentRisks[0] > 0.3) {
        anomalyScore += 0.2;
        factors.push("Escalating risk pattern");
      }
    }

    return {
      anomalyScore: Math.min(1, anomalyScore),
      factors,
      recentEventCount: events.length,
    };
  },
});

/**
 * Simple similarity calculation (Jaccard-like)
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORT PATTERNS FOR EXTERNAL USE
// ═══════════════════════════════════════════════════════════════════════════════

export { INJECTION_PATTERNS };
