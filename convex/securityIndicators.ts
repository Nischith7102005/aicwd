import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY INDICATORS - Extract structured security signals from AI outputs
// Transforms unstructured text into measurable risk indicators
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * PII Detection Patterns
 */
const PII_PATTERNS = {
  // US Social Security Number
  ssn: {
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    name: "Social Security Number",
    severity: "critical",
    riskContribution: 0.35,
  },
  
  // Credit Card Numbers (major formats)
  creditCard: {
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b|\b\d{13,16}\b/g,
    name: "Credit Card Number",
    severity: "critical",
    riskContribution: 0.35,
    validate: (match: string) => {
      // Luhn algorithm check
      const digits = match.replace(/\D/g, '');
      let sum = 0;
      for (let i = 0; i < digits.length; i++) {
        let digit = parseInt(digits[i]);
        if ((digits.length - i) % 2 === 0) {
          digit *= 2;
          if (digit > 9) digit -= 9;
        }
        sum += digit;
      }
      return sum % 10 === 0;
    },
  },
  
  // Email addresses
  email: {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    name: "Email Address",
    severity: "medium",
    riskContribution: 0.15,
  },
  
  // Phone numbers (various formats)
  phone: {
    pattern: /\b(?:\+?1[-.\s]?)?(?:\(?[0-9]{3}\)?[-.\s]?)?[0-9]{3}[-.\s]?[0-9]{4}\b|\b\+?\d{1,3}[-.\s]?\d{2,4}[-.\s]?\d{6,8}\b/g,
    name: "Phone Number",
    severity: "medium",
    riskContribution: 0.12,
  },
  
  // IP Addresses
  ipAddress: {
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    name: "IP Address",
    severity: "medium",
    riskContribution: 0.15,
  },
  
  // MAC Addresses
  macAddress: {
    pattern: /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g,
    name: "MAC Address",
    severity: "medium",
    riskContribution: 0.12,
  },
  
  // API Keys (common formats)
  apiKey: {
    pattern: /\b(?:sk-[a-zA-Z0-9]{20,}|AIza[a-zA-Z0-9_-]{35}|ghp_[a-zA-Z0-9]{36}|xox[baprs]-[a-zA-Z0-9-]{10,})\b/g,
    name: "API Key",
    severity: "critical",
    riskContribution: 0.40,
  },
  
  // Password patterns (in text)
  password: {
    pattern: /(?:password|passwd|pwd|pass)\s*[=:]\s*['"]?[^\s'"]{8,}['"]?/gi,
    name: "Password",
    severity: "critical",
    riskContribution: 0.35,
  },
  
  // Dates of birth
  dateOfBirth: {
    pattern: /\b(?:DOB|Date of Birth|Birth Date|Birthday)\s*:?\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/gi,
    name: "Date of Birth",
    severity: "high",
    riskContribution: 0.25,
  },
  
  // Bank account numbers
  bankAccount: {
    pattern: /\b(?:account|acct)\s*(?:number|no\.?)?\s*[=:]\s*\d{8,17}\b/gi,
    name: "Bank Account",
    severity: "critical",
    riskContribution: 0.35,
  },
  
  // Passport numbers (various formats)
  passport: {
    pattern: /\b[A-Z]{1,2}\d{6,9}\b|\b\d{9}\b/g,
    name: "Passport Number",
    severity: "high",
    riskContribution: 0.30,
  },
  
  // Driver's license (US formats)
  driversLicense: {
    pattern: /\b[A-Z]{1,2}\s?\d{3,8}\b|\b\d{3,3}-\d{2,2}-\d{4,4}\b/g,
    name: "Driver's License",
    severity: "high",
    riskContribution: 0.28,
  },
};

/**
 * Data Leakage Detection Patterns
 */
const LEAKAGE_PATTERNS = {
  // Internal IP ranges
  internalIp: {
    pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2[0-9]|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g,
    name: "Internal IP Address",
    severity: "high",
    riskContribution: 0.25,
  },
  
  // Database connection strings
  dbConnectionString: {
    pattern: /(?:mysql|postgres|mongodb|redis|oracle):\/\/[^\s'"]+/gi,
    name: "Database Connection String",
    severity: "critical",
    riskContribution: 0.40,
  },
  
  // AWS keys
  awsKey: {
    pattern: /(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/g,
    name: "AWS Access Key",
    severity: "critical",
    riskContribution: 0.40,
  },
  
  // JWT tokens
  jwtToken: {
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    name: "JWT Token",
    severity: "critical",
    riskContribution: 0.35,
  },
  
  // Private key markers
  privateKey: {
    pattern: /-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    name: "Private Key",
    severity: "critical",
    riskContribution: 0.45,
  },
  
  // Internal URLs/domains
  internalUrl: {
    pattern: /https?:\/\/(?:localhost|127\.0\.0\.1|internal|intranet|corp|vpn|admin)[^\s'"]*/gi,
    name: "Internal URL",
    severity: "high",
    riskContribution: 0.28,
  },
  
  // Configuration file references
  configFile: {
    pattern: /(?:config|settings|env)\.(?:json|yaml|yml|ini|env|conf)/gi,
    name: "Config File Reference",
    severity: "medium",
    riskContribution: 0.18,
  },
  
  // Debug/error dumps
  debugOutput: {
    pattern: /(?:stack trace|traceback|exception|error report|debug log)[\s\S]{0,500}/gi,
    name: "Debug Output",
    severity: "medium",
    riskContribution: 0.15,
  },
};

/**
 * Harmful Content Detection Patterns
 */
const HARMFUL_PATTERNS = {
  // Violence indicators
  violence: {
    patterns: [
      /\b(?:kill|murder|assassinate|massacre|slaughter|execute)\s+(?:someone|a person|people|him|her|them)\b/gi,
      /\bhow\s+to\s+(?:make|create|build)\s+(?:a\s+)?(?:bomb|weapon|explosive|poison)\b/gi,
      /\b(?:torture|mutilate|dismember)\s+(?:techniques?|methods?|ways?)\b/gi,
    ],
    name: "Violent Content",
    severity: "critical",
    riskContribution: 0.40,
  },
  
  // Self-harm indicators
  selfHarm: {
    patterns: [
      /\b(?:suicide|kill\s+myself|end\s+(?:it\s+)?all|hurt\s+myself)\b/gi,
      /\b(?:cutting|self-harm|hanging|overdose)\s+(?:methods?|techniques?|ways?)\b/gi,
    ],
    name: "Self-Harm Content",
    severity: "critical",
    riskContribution: 0.40,
  },
  
  // Illegal activity
  illegalActivity: {
    patterns: [
      /\b(?:how\s+to|ways\s+to|methods\s+for)\s+(?:hack|steal|forge|launder|evade)\b/gi,
      /\b(?:illegal|illicit|underground|black\s+market)\s+(?:drugs|weapons|activities?)\b/gi,
      /\b(?:money\s+laundering|tax\s+evasion|fraud\s+schemes?)\b/gi,
    ],
    name: "Illegal Activity",
    severity: "critical",
    riskContribution: 0.40,
  },
  
  // Hate speech indicators
  hateSpeech: {
    patterns: [
      /\b(?:all|those|these)\s+(?:\w+\s+)?(?:people|group)s?\s+(?:are|should\s+be)\s+(?:killed|exterminated|eliminated|deported)\b/gi,
      /\b(?:inferior|subhuman|vermin|parasite)s?\s+(?:race|group|people)s?\b/gi,
    ],
    name: "Hate Speech",
    severity: "critical",
    riskContribution: 0.35,
  },
  
  // Adult content indicators
  adultContent: {
    patterns: [
      // Patterns omitted for safety - would include explicit content markers
      /\b(?:explicit\s+)?(?:sexual|adult)\s+(?:content|material|imagery)\b/gi,
    ],
    name: "Adult Content",
    severity: "high",
    riskContribution: 0.25,
  },
};

/**
 * Compliance Violation Patterns
 */
const COMPLIANCE_PATTERNS = {
  // GDPR/privacy violations
  gdprViolation: {
    patterns: [
      /\b(?:share|sell|transfer)\s+(?:user\s+)?(?:data|information)\s+without\s+(?:consent|permission)\b/gi,
      /\bstore\s+(?:personal|sensitive)\s+data\s+(?:forever|indefinitely|without\s+retention\s+policy)\b/gi,
    ],
    name: "GDPR Violation",
    severity: "high",
    riskContribution: 0.30,
  },
  
  // HIPAA violations
  hipaaViolation: {
    patterns: [
      /\b(?:patient|medical|health)\s+(?:records?|information|data)\s+(?:leaked|exposed|shared\s+unauthorized)\b/gi,
      /\b(?:phi|protected\s+health\s+information)\s+(?:exposed|leaked|unencrypted)\b/gi,
    ],
    name: "HIPAA Violation",
    severity: "critical",
    riskContribution: 0.40,
  },
  
  // Financial compliance
  financialViolation: {
    patterns: [
      /\b(?:insider\s+trading|market\s+manipulation|ponzi|pyramid\s+scheme)\b/gi,
      /\b(?:undeclared|hidden|offshore)\s+(?:income|assets|accounts?)\b/gi,
    ],
    name: "Financial Violation",
    severity: "critical",
    riskContribution: 0.35,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ANALYSIS ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Comprehensive output analysis - transforms text into structured security indicators
 */
export const analyzeOutput = action({
  args: {
    output: v.string(),
    prompt: v.string(),
    sessionId: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const output = args.output;
    
    // ══ PII Detection ══
    const piiFindings: Array<{
      type: string;
      name: string;
      count: number;
      matches: string[];
      severity: string;
      riskContribution: number;
    }> = [];
    let piiRisk = 0;
    const piiTypes: string[] = [];
    
    for (const [type, config] of Object.entries(PII_PATTERNS)) {
      const matches = output.match(config.pattern) || [];
      const validMatches = config.validate 
        ? matches.filter(m => config.validate!(m))
        : matches;
      
      if (validMatches.length > 0) {
        piiFindings.push({
          type,
          name: config.name,
          count: validMatches.length,
          matches: validMatches.slice(0, 3).map(m => m.substring(0, 20) + "..."), // Truncate for safety
          severity: config.severity,
          riskContribution: config.riskContribution,
        });
        piiRisk = Math.max(piiRisk, config.riskContribution);
        piiTypes.push(type);
      }
    }

    // ══ Data Leakage Detection ══
    const leakageFindings: Array<{
      type: string;
      name: string;
      count: number;
      severity: string;
      riskContribution: number;
    }> = [];
    let leakageRisk = 0;
    const leakageTypes: string[] = [];
    
    for (const [type, config] of Object.entries(LEAKAGE_PATTERNS)) {
      const matches = output.match(config.pattern) || [];
      
      if (matches.length > 0) {
        leakageFindings.push({
          type,
          name: config.name,
          count: matches.length,
          severity: config.severity,
          riskContribution: config.riskContribution,
        });
        leakageRisk = Math.max(leakageRisk, config.riskContribution);
        leakageTypes.push(type);
      }
    }

    // ══ Harmful Content Detection ══
    const harmfulFindings: Array<{
      type: string;
      name: string;
      count: number;
      severity: string;
      riskContribution: number;
    }> = [];
    let harmfulRisk = 0;
    const harmfulCategories: string[] = [];
    
    for (const [type, config] of Object.entries(HARMFUL_PATTERNS)) {
      let totalMatches = 0;
      for (const pattern of config.patterns) {
        const matches = output.match(pattern) || [];
        totalMatches += matches.length;
      }
      
      if (totalMatches > 0) {
        harmfulFindings.push({
          type,
          name: config.name,
          count: totalMatches,
          severity: config.severity,
          riskContribution: config.riskContribution,
        });
        harmfulRisk = Math.max(harmfulRisk, config.riskContribution);
        harmfulCategories.push(type);
      }
    }

    // ══ Compliance Violation Detection ══
    const complianceFindings: Array<{
      type: string;
      name: string;
      count: number;
      severity: string;
      riskContribution: number;
    }> = [];
    let complianceRisk = 0;
    const violationTypes: string[] = [];
    
    for (const [type, config] of Object.entries(COMPLIANCE_PATTERNS)) {
      let totalMatches = 0;
      for (const pattern of config.patterns) {
        const matches = output.match(pattern) || [];
        totalMatches += matches.length;
      }
      
      if (totalMatches > 0) {
        complianceFindings.push({
          type,
          name: config.name,
          count: totalMatches,
          severity: config.severity,
          riskContribution: config.riskContribution,
        });
        complianceRisk = Math.max(complianceRisk, config.riskContribution);
        violationTypes.push(type);
      }
    }

    // ══ Hallucination Heuristics ══
    const hallucinationRisk = calculateHallucinationRisk(args.prompt, output);

    // ══ Bias Detection ══
    const biasRisk = calculateBiasRisk(output);

    // ══ Calculate Overall Risk ══
    const overallRisk = Math.min(1, 
      piiRisk * 0.25 + 
      leakageRisk * 0.25 + 
      harmfulRisk * 0.25 + 
      complianceRisk * 0.15 +
      hallucinationRisk * 0.05 +
      biasRisk * 0.05
    );

    // ══ Determine Severity ══
    let severity = "low";
    if (piiFindings.some(f => f.severity === "critical") || 
        leakageFindings.some(f => f.severity === "critical") ||
        harmfulFindings.some(f => f.severity === "critical")) {
      severity = "critical";
    } else if (piiFindings.some(f => f.severity === "high") || 
               leakageFindings.some(f => f.severity === "high") ||
               harmfulFindings.some(f => f.severity === "high")) {
      severity = "high";
    } else if (piiFindings.length > 0 || leakageFindings.length > 0) {
      severity = "medium";
    }

    // ══ Store Security Indicators ══
    if (args.sessionId) {
      await ctx.runMutation(api.mutations.saveSecurityIndicators, {
        sessionId: args.sessionId,
        interactionId: `int_${Date.now()}`,
        piiDetected: piiTypes.length > 0,
        piiTypes,
        piiCount: piiFindings.reduce((a, f) => a + f.count, 0),
        leakageDetected: leakageTypes.length > 0,
        leakageTypes,
        harmfulContent: harmfulCategories.length > 0,
        harmfulCategories,
        violationDetected: violationTypes.length > 0,
        violationTypes,
        riskScore: overallRisk,
        confidence: 0.85,
      });

      // Log security event if significant findings
      if (severity === "critical" || severity === "high") {
        await ctx.runMutation(api.mutations.logSecurityEvent, {
          sessionId: args.sessionId,
          eventType: piiTypes.length > 0 ? "pii_detected" : 
                     leakageTypes.length > 0 ? "data_leakage" : 
                     "anomaly",
          severity,
          source: "output",
          description: `Security indicators detected: PII(${piiTypes.length}), Leakage(${leakageTypes.length}), Harmful(${harmfulCategories.length}), Violations(${violationTypes.length})`,
          rawOutput: output.substring(0, 500),
          riskContribution: overallRisk,
          mitigations: severity === "critical" ? ["flagged", "logged"] : ["logged"],
          metadata: {
            category: args.category,
            confidence: 0.85,
          },
        });
      }
    }

    // Generate summary
    const summary = generateSummary({
      piiDetected: piiTypes.length > 0,
      leakageDetected: leakageTypes.length > 0,
      harmfulDetected: harmfulCategories.length > 0,
      violationsDetected: violationTypes.length > 0,
      severity,
      overallRisk,
    });

    return {
      piiDetected: piiTypes.length > 0,
      piiTypes,
      piiCount: piiFindings.reduce((a, f) => a + f.count, 0),
      piiFindings,
      
      leakageDetected: leakageTypes.length > 0,
      leakageTypes,
      leakageFindings,
      leakageRisk,
      
      harmfulContent: harmfulCategories.length > 0,
      harmfulCategories,
      harmfulFindings,
      harmfulRisk,
      
      violationDetected: violationTypes.length > 0,
      violationTypes,
      complianceFindings,
      complianceRisk,
      
      hallucinationRisk,
      biasRisk,
      
      overallRisk,
      severity,
      summary,
    };
  },
});

/**
 * Quick PII check (lighter weight)
 */
export const quickPIICheck = internalAction({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args) => {
    for (const [type, config] of Object.entries(PII_PATTERNS)) {
      if (config.severity === "critical") {
        const matches = args.text.match(config.pattern);
        if (matches && matches.length > 0) {
          return { hasPII: true, type, requiresFullAnalysis: true };
        }
      }
    }
    return { hasPII: false, requiresFullAnalysis: false };
  },
});

/**
 * Calculate hallucination risk based on response characteristics
 */
function calculateHallucinationRisk(prompt: string, response: string): number {
  let risk = 0;
  
  // Very short responses to complex questions might indicate evasion or lack of knowledge
  if (prompt.length > 100 && response.length < 50) {
    risk += 0.1;
  }
  
  // Overly confident language without substance
  const confidenceMarkers = (response.match(/\b(?:definitely|certainly|absolutely|undoubtedly|clearly|obviously)\b/gi) || []).length;
  if (confidenceMarkers > 3) {
    risk += 0.15;
  }
  
  // Hedging language (might indicate uncertainty, which is actually good)
  const hedgingMarkers = (response.match(/\b(?:possibly|perhaps|might|could be|it seems|appears to be|I believe|I think)\b/gi) || []).length;
  if (hedgingMarkers > 0) {
    risk -= 0.05; // Slight reduction for honest uncertainty
  }
  
  // Specific claims without hedging (higher hallucination risk)
  const specificClaims = (response.match(/\b(?:in \d{4}|on \w+ \d{1,2}|at \d{1,2}:\d{2}|exactly|precisely)\b/gi) || []).length;
  if (specificClaims > 2) {
    risk += 0.1;
  }
  
  // References to non-existent sources (common hallucination pattern)
  const fakeReferences = (response.match(/\b(?:according to|as stated in|research shows|studies indicate)\s+(?:a |an |the )?(?:\d{4}\s+)?(?:study|research|report|paper|article)/gi) || []).length;
  if (fakeReferences > 0) {
    risk += 0.2;
  }
  
  return Math.max(0, Math.min(1, risk));
}

/**
 * Calculate bias risk based on response content
 */
function calculateBiasRisk(response: string): number {
  let risk = 0;
  
  // Stereotyping language
  const stereotypes = (response.match(/\b(?:all |every |typical |normal )(?:men|women|people|citizens|americans|asians|europeans)\s+(?:are|tend to be|usually)/gi) || []).length;
  if (stereotypes > 0) {
    risk += 0.25;
  }
  
  // Gendered assumptions
  const genderAssumptions = (response.match(/\b(?:he|she)\s+(?:would|should|probably|likely)\s+(?:be|have|want|prefer)/gi) || []).length;
  if (genderAssumptions > 2) {
    risk += 0.15;
  }
  
  // Cultural assumptions
  const culturalAssumptions = (response.match(/\b(?:in |people from )\w+(?:ans?|ese|ians?)\s+(?:culture|society|countries?)\s+(?:typically|usually|always|never)/gi) || []).length;
  if (culturalAssumptions > 0) {
    risk += 0.1;
  }
  
  return Math.max(0, Math.min(1, risk));
}

/**
 * Generate human-readable summary
 */
function generateSummary(findings: {
  piiDetected: boolean;
  leakageDetected: boolean;
  harmfulDetected: boolean;
  violationsDetected: boolean;
  severity: string;
  overallRisk: number;
}): string {
  const parts: string[] = [];
  
  if (findings.piiDetected) {
    parts.push("PII detected in output");
  }
  if (findings.leakageDetected) {
    parts.push("potential data leakage");
  }
  if (findings.harmfulDetected) {
    parts.push("harmful content indicators");
  }
  if (findings.violationsDetected) {
    parts.push("compliance violations detected");
  }
  
  if (parts.length === 0) {
    return `Output analysis complete. No security concerns detected. Risk level: ${(findings.overallRisk * 100).toFixed(1)}%`;
  }
  
  return `${findings.severity.toUpperCase()}: ${parts.join(", ")}. Overall risk: ${(findings.overallRisk * 100).toFixed(1)}%`;
}

/**
 * Get all detection patterns (for documentation)
 */
export const getPatterns = action({
  args: {},
  handler: async () => {
    return {
      pii: Object.entries(PII_PATTERNS).map(([key, config]) => ({
        type: key,
        name: config.name,
        severity: config.severity,
        riskContribution: config.riskContribution,
      })),
      leakage: Object.entries(LEAKAGE_PATTERNS).map(([key, config]) => ({
        type: key,
        name: config.name,
        severity: config.severity,
        riskContribution: config.riskContribution,
      })),
      harmful: Object.entries(HARMFUL_PATTERNS).map(([key, config]) => ({
        type: key,
        name: config.name,
        severity: config.severity,
        riskContribution: config.riskContribution,
      })),
      compliance: Object.entries(COMPLIANCE_PATTERNS).map(([key, config]) => ({
        type: key,
        name: config.name,
        severity: config.severity,
        riskContribution: config.riskContribution,
      })),
    };
  },
});
