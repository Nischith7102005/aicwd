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

// Simple coherence score based on sentence structure
function computeCoherenceScore(response: string): number {
  const sentences = response.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length === 0) return 0.5;
  
  // Check for basic coherence markers
  const hasTransitions = /\b(however|therefore|moreover|additionally|furthermore|consequently)\b/i.test(response);
  const avgSentenceLength = response.split(/\s+/).length / sentences.length;
  
  let score = 0.7; // Base score
  if (hasTransitions) score += 0.15;
  if (avgSentenceLength > 10 && avgSentenceLength < 30) score += 0.15; // Good length
  
  return Math.max(0, Math.min(1, score));
}

// Simple relevance score based on keyword overlap
function computeRelevanceScore(prompt: string, response: string): number {
  const extractKeywords = (text: string) => {
    return new Set(text.toLowerCase().match(/\b[a-z]{4,}\b/g) || []);
  };
  
  const promptKeywords = extractKeywords(prompt);
  const responseKeywords = extractKeywords(response);
  
  if (promptKeywords.size === 0) return 0.5;
  
  let overlap = 0;
  for (const keyword of promptKeywords) {
    if (responseKeywords.has(keyword)) overlap++;
  }
  
  return Math.min(1, overlap / promptKeywords.size + 0.3);
}

export const storeInference = internalMutation({
  args: {
    prompt: v.string(),
    response: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    inputTokens: v.number(),
    outputTokens: v.number(),
    latencyMs: v.number(),
    firstTokenLatencyMs: v.optional(v.number()),
    model: v.string(),
    provider: v.string(),
    endpoint: v.string(),
    apiConfigId: v.id("api_configs"),
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
    finishReason: v.optional(v.string()),
    isAdversarial: v.optional(v.boolean()),
    testType: v.optional(v.string()),
    success: v.optional(v.boolean()),
    errorMessage: v.optional(v.string()),
    errorType: v.optional(v.string()),
    statusCode: v.optional(v.number()),
    batchId: v.optional(v.string()),
    userId: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const success = args.success ?? true;
    const isAdversarial = args.isAdversarial ?? false;
    
    // Get API config for pricing info
    const apiConfig = await ctx.db.get(args.apiConfigId);
    if (!apiConfig) {
      throw new Error(`API config not found: ${args.apiConfigId}`);
    }

    // Calculate costs
    const inputCostUsd = apiConfig.inputPricePer1M 
      ? (args.inputTokens / 1_000_000) * apiConfig.inputPricePer1M 
      : 0;
    const outputCostUsd = apiConfig.outputPricePer1M 
      ? (args.outputTokens / 1_000_000) * apiConfig.outputPricePer1M 
      : 0;
    const costUsd = inputCostUsd + outputCostUsd;

    // Calculate basic metrics
    const totalTokens = args.inputTokens + args.outputTokens;
    const tokensPerSecond = args.latencyMs > 0 
      ? (args.outputTokens / (args.latencyMs / 1000)) 
      : 0;
    const outputRatio = totalTokens > 0 
      ? args.outputTokens / totalTokens 
      : 0;

    // Only compute quality metrics if the inference was successful and has a response
    let semanticDrift = undefined;
    let hallucinationScore = undefined;
    let coherenceScore = undefined;
    let relevanceScore = undefined;
    let efficiencyRatio = undefined;
    let wasteIndex = undefined;

    if (success && args.response) {
      semanticDrift = computeSemanticDrift(args.prompt, args.response);
      hallucinationScore = computeHallucinationProb(args.response, args.latencyMs);
      coherenceScore = computeCoherenceScore(args.response);
      relevanceScore = computeRelevanceScore(args.prompt, args.response);
      efficiencyRatio = args.inputTokens > 0 ? args.outputTokens / args.inputTokens : 0;
      wasteIndex = Math.min(1, semanticDrift * efficiencyRatio * 0.8);
    }

    // Store aggregated metrics
    await ctx.db.insert("metrics", {
      timestamp,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      totalTokens,
      latencyMs: args.latencyMs,
      tokensPerSecond,
      costUsd,
      inputCostUsd,
      outputCostUsd,
      efficiencyRatio,
      outputRatio,
      semanticDrift,
      wasteIndex,
      hallucinationScore,
      coherenceScore,
      relevanceScore,
      targetModel: args.model,
      provider: args.provider,
      apiConfigId: args.apiConfigId,
      endpoint: args.endpoint,
      success,
      errorMessage: args.errorMessage,
      errorType: args.errorType,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
      systemPrompt: args.systemPrompt,
      batchId: args.batchId,
    });

    // Store raw inference data
    await ctx.db.insert("raw_inferences", {
      timestamp,
      prompt: args.prompt,
      response: args.response,
      systemPrompt: args.systemPrompt,
      temperature: args.temperature,
      maxTokens: args.maxTokens,
      finishReason: args.finishReason,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      model: args.model,
      provider: args.provider,
      apiConfigId: args.apiConfigId,
      endpoint: args.endpoint,
      latencyMs: args.latencyMs,
      firstTokenLatencyMs: args.firstTokenLatencyMs,
      success,
      errorMessage: args.errorMessage,
      errorType: args.errorType,
      statusCode: args.statusCode,
      isAdversarial,
      testType: args.testType,
      batchId: args.batchId,
      userId: args.userId,
      sessionId: args.sessionId,
      tags: args.tags,
    });

    // Generate appropriate logs
    let level: "INFO" | "ALERT" | "DEBUG" | "WARN" | "ERROR" = "INFO";
    let message = "";
    let category = "api";

    if (!success) {
      level = "ERROR";
      category = "performance";
      message = `Inference failed for ${args.model}: ${args.errorMessage || "Unknown error"}`;
    } else if (semanticDrift !== undefined && semanticDrift > 0.6) {
      level = "ALERT";
      category = "performance";
      message = `High semantic drift (${args.model}): ${(semanticDrift * 100).toFixed(1)}%`;
    } else if (hallucinationScore !== undefined && hallucinationScore > 0.15) {
      level = "WARN";
      category = "performance";
      message = `Elevated hallucination risk (${args.model}): ${(hallucinationScore * 100).toFixed(1)}%`;
    } else if (isAdversarial) {
      level = "DEBUG";
      category = "security";
      message = `Adversarial probe processed (${args.model}): drift=${semanticDrift !== undefined ? (semanticDrift * 100).toFixed(1) : 'N/A'}%`;
    } else {
      level = "INFO";
      message = `Inference: ${args.model} ${args.inputTokens}→${args.outputTokens} tokens (${args.latencyMs}ms, $${costUsd.toFixed(6)})`;
    }

    await ctx.db.insert("logs", {
      timestamp,
      level,
      message,
      category,
      apiConfigId: args.apiConfigId,
      source: "storeInference",
      metadata: {
        batchId: args.batchId,
        success,
        model: args.model,
        provider: args.provider,
      },
    });

    return {
      semanticDrift,
      hallucinationScore: hallucinationScore,
      coherenceScore,
      relevanceScore,
      wasteIndex,
      efficiencyRatio,
      success,
      costUsd,
      tokensPerSecond,
    };
  },
});

export const addLog = internalMutation({
  args: {
    level: v.union(
      v.literal("INFO"),
      v.literal("ALERT"),
      v.literal("DEBUG"),
      v.literal("WARN"),
      v.literal("ERROR")
    ),
    message: v.string(),
    category: v.optional(v.string()),
    apiConfigId: v.optional(v.id("api_configs")),
    source: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("logs", {
      timestamp: Date.now(),
      level: args.level,
      message: args.message,
      category: args.category,
      apiConfigId: args.apiConfigId,
      source: args.source,
      metadata: args.metadata,
    });
  },
});

export const createApiConfig = internalMutation({
  args: {
    name: v.string(),
    endpoint: v.string(),
    apiKey: v.string(),
    modelName: v.string(),
    provider: v.string(),
    isActive: v.optional(v.boolean()),
    inputPricePer1M: v.optional(v.number()),
    outputPricePer1M: v.optional(v.number()),
    defaultTemperature: v.optional(v.number()),
    defaultMaxTokens: v.optional(v.number()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const configId = await ctx.db.insert("api_configs", {
      name: args.name,
      endpoint: args.endpoint,
      apiKey: args.apiKey,
      modelName: args.modelName,
      provider: args.provider,
      isActive: args.isActive ?? true,
      createdAt: Date.now(),
      inputPricePer1M: args.inputPricePer1M,
      outputPricePer1M: args.outputPricePer1M,
      defaultTemperature: args.defaultTemperature,
      defaultMaxTokens: args.defaultMaxTokens,
      description: args.description,
      tags: args.tags,
    });

    await ctx.db.insert("logs", {
      timestamp: Date.now(),
      level: "INFO",
      message: `API config created: ${args.name} (${args.provider}/${args.modelName})`,
      category: "api",
      apiConfigId: configId,
      source: "createApiConfig",
    });

    return configId;
  },
});

export const updateApiConfig = internalMutation({
  args: {
    id: v.id("api_configs"),
    name: v.optional(v.string()),
    endpoint: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    modelName: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    inputPricePer1M: v.optional(v.number()),
    outputPricePer1M: v.optional(v.number()),
    defaultTemperature: v.optional(v.number()),
    defaultMaxTokens: v.optional(v.number()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);

    await ctx.db.insert("logs", {
      timestamp: Date.now(),
      level: "INFO",
      message: `API config updated: ${id}`,
      category: "api",
      apiConfigId: id,
      source: "updateApiConfig",
      metadata: { updates: Object.keys(updates) },
    });
  },
});

export const deleteApiConfig = internalMutation({
  args: {
    id: v.id("api_configs"),
  },
  handler: async (ctx, args) => {
    const config = await ctx.db.get(args.id);
    
    await ctx.db.delete(args.id);

    await ctx.db.insert("logs", {
      timestamp: Date.now(),
      level: "WARN",
      message: `API config deleted: ${config?.name || args.id}`,
      category: "api",
      source: "deleteApiConfig",
      metadata: { configId: args.id },
    });
  },
});
