import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Simple word frequency cosine similarity for semantic drift
function computeSemanticDrift(prompt: string, response: string): number {
  const tokenize = (text: string) => {
    const words = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
    const freq: Record<string, number> = {};
    for (const w of words) freq[w] = (freq[w] || 0) + 1;
    return freq;
  };

  const pFreq = tokenize(prompt);
  const rFreq = tokenize(response);
  const allWords = new Set([...Object.keys(pFreq), ...Object.keys(rFreq)]);

  let dot = 0, pMag = 0, rMag = 0;
  for (const word of allWords) {
    const pVal = pFreq[word] || 0;
    const rVal = rFreq[word] || 0;
    dot += pVal * rVal;
    pMag += pVal * pVal;
    rMag += rVal * rVal;
  }

  const similarity = dot / (Math.sqrt(pMag) * Math.sqrt(rMag) || 1);
  return Math.max(0, Math.min(1, 1 - similarity));
}

// Heuristic hallucination probability
function computeHallucinationProb(response: string, latencyMs: number): number {
  let prob = 0.02;

  // Specific numbers/dates are risky
  const dateMatches = response.match(/\b(19|20)\d{2}\b/g) || [];
  prob += dateMatches.length * 0.01;

  // Hedging words reduce risk
  const hedges = ["perhaps", "might", "possibly", "unclear", "approximately", "around"];
  if (hedges.some((h) => response.toLowerCase().includes(h))) prob *= 0.6;

  // Overconfident language increases risk
  const overconfident = ["definitely", "certainly", "absolutely", "always", "never", "guaranteed"];
  if (overconfident.some((w) => response.toLowerCase().includes(w))) prob += 0.03;

  // Very fast = likely cached/memorized
  if (latencyMs < 300) prob *= 0.5;

  // Very slow might indicate uncertainty or complex generation
  if (latencyMs > 5000) prob += 0.02;

  return Math.max(0.01, Math.min(0.5, prob));
}

export const storeInference = internalMutation({
  args: {
    prompt: v.string(),
    response: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    latencyMs: v.number(),
    model: v.string(),
    isAdversarial: v.boolean(),
    apiConfigId: v.id("api_configs"),
    success: v.optional(v.boolean()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const success = args.success ?? true;
    
    // Only compute metrics if the inference was successful
    let semanticDrift = 0;
    let hallucinationProb = 0;
    let efficiencyRatio = 0;
    let wasteIndex = 0;

    if (success && args.response) {
      semanticDrift = computeSemanticDrift(args.prompt, args.response);
      hallucinationProb = computeHallucinationProb(args.response, args.latencyMs);
      efficiencyRatio = args.inputTokens > 0 ? args.outputTokens / args.inputTokens : 0;
      wasteIndex = Math.min(1, semanticDrift * efficiencyRatio * 0.8);
    }

    // Store metrics
    await ctx.db.insert("metrics", {
      timestamp,
      efficiencyRatio,
      semanticDrift,
      wasteIndex,
      hallucinationProb,
      targetModel: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      latencyMs: args.latencyMs,
      apiConfigId: args.apiConfigId,
      success,
      errorMessage: args.errorMessage,
    });

    // Store raw inference (even if failed)
    await ctx.db.insert("raw_inferences", {
      timestamp,
      prompt: args.prompt,
      response: success ? args.response : (args.errorMessage || "ERROR"),
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      model: args.model,
      isAdversarial: args.isAdversarial,
      apiConfigId: args.apiConfigId,
    });

    // Generate log
    let level: "INFO" | "ALERT" | "DEBUG" = "INFO";
    let message = "";

    if (!success) {
      level = "ALERT";
      message = `Inference failed for ${args.model}: ${args.errorMessage || "Unknown error"}`;
    } else if (semanticDrift > 0.6) {
      level = "ALERT";
      message = `High semantic drift (${args.model}): ${(semanticDrift * 100).toFixed(1)}%`;
    } else if (hallucinationProb > 0.15) {
      level = "ALERT";
      message = `Elevated hallucination risk (${args.model}): ${(hallucinationProb * 100).toFixed(1)}%`;
    } else if (args.isAdversarial) {
      level = "DEBUG";
      message = `Adversarial probe processed (${args.model}): drift=${(semanticDrift * 100).toFixed(1)}%`;
    } else {
      message = `Inference: ${args.model} ${args.inputTokens}→${args.outputTokens} tokens (${args.latencyMs}ms)`;
    }

    await ctx.db.insert("logs", { timestamp, level, message });

    return { semanticDrift, hallucinationProb, wasteIndex, efficiencyRatio, success };
  },
});

export const addLog = internalMutation({
  args: {
    level: v.union(v.literal("INFO"), v.literal("ALERT"), v.literal("DEBUG")),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("logs", {
      timestamp: Date.now(),
      level: args.level,
      message: args.message,
    });
  },
});

export const createApiConfig = internalMutation({
  args: {
    name: v.string(),
    provider: v.union(
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("google"),
      v.literal("groq"),
      v.literal("deepseek"),
      v.literal("openrouter")
    ),
    baseUrl: v.optional(v.string()),
    model: v.string(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const configId = await ctx.db.insert("api_configs", {
      name: args.name,
      provider: args.provider,
      baseUrl: args.baseUrl,
      model: args.model,
      isActive: args.isActive,
      createdAt: Date.now(),
    });
    
    await ctx.db.insert("logs", {
      timestamp: Date.now(),
      level: "INFO",
      message: `API config created: ${args.name} (${args.provider}/${args.model})`,
    });
    
    return configId;
  },
});

export const updateApiConfig = internalMutation({
  args: {
    id: v.id("api_configs"),
    isActive: v.optional(v.boolean()),
    model: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
    
    await ctx.db.insert("logs", {
      timestamp: Date.now(),
      level: "INFO",
      message: `API config updated: ${id}`,
    });
  },
});

export const deleteApiConfig = internalMutation({
  args: {
    id: v.id("api_configs"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    
    await ctx.db.insert("logs", {
      timestamp: Date.now(),
      level: "INFO",
      message: `API config deleted: ${args.id}`,
    });
  },
});
