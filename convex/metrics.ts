import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

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

function computeHallucinationProb(response: string, latencyMs: number): number {
  let prob = 0.02;

  const dateMatches = response.match(/\b(19|20)\d{2}\b/g) || [];
  prob += dateMatches.length * 0.01;

  const hedges = ["perhaps", "might", "possibly", "unclear", "approximately", "around"];
  if (hedges.some((h) => response.toLowerCase().includes(h))) prob *= 0.6;

  const overconfident = ["definitely", "certainly", "absolutely", "always", "never", "guaranteed"];
  if (overconfident.some((w) => response.toLowerCase().includes(w))) prob += 0.03;

  if (latencyMs < 300) prob *= 0.5;

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
    censorshipScore: v.number(),
    biasScore: v.number(),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const semanticDrift = computeSemanticDrift(args.prompt, args.response);
    const hallucinationProb = computeHallucinationProb(args.response, args.latencyMs);
    const efficiencyRatio = args.inputTokens > 0 ? args.outputTokens / args.inputTokens : 0;
    const wasteIndex = Math.min(1, semanticDrift * efficiencyRatio * 0.8);

    await ctx.db.insert("metrics", {
      timestamp,
      efficiencyRatio,
      semanticDrift,
      wasteIndex,
      hallucinationProb,
      censorshipScore: args.censorshipScore,
      biasScore: args.biasScore,
      targetModel: args.model,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      latencyMs: args.latencyMs,
    });

    await ctx.db.insert("raw_inferences", {
      timestamp,
      prompt: args.prompt,
      response: args.response,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      model: args.model,
      isAdversarial: args.isAdversarial,
    });

    let level: "INFO" | "ALERT" | "DEBUG" = "INFO";
    let message = `Inference: ${args.inputTokens}→${args.outputTokens} tokens (${args.latencyMs}ms)`;

    if (semanticDrift > 0.6) {
      level = "ALERT";
      message = `High semantic drift: ${(semanticDrift * 100).toFixed(1)}%`;
    } else if (hallucinationProb > 0.1) {
      level = "ALERT";
      message = `Elevated hallucination risk: ${(hallucinationProb * 100).toFixed(1)}%`;
    } else if (args.isAdversarial) {
      level = "DEBUG";
      message = `Adversarial probe processed: drift=${(semanticDrift * 100).toFixed(1)}%`;
    }

    await ctx.db.insert("logs", { timestamp, level, message });

    return { semanticDrift, hallucinationProb, wasteIndex, efficiencyRatio };
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
