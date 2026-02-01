import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function callTargetLLM(apiKey: string, prompt: string) {
    console.log(`[Ingest] Simulating call with Key: ${apiKey.substring(0,5)}...`);
    await new Promise(resolve => setTimeout(resolve, 500)); 
    const inputTokens = prompt.length / 4; 
    return {
        inputTokens: Math.floor(inputTokens),
        outputTokens: Math.floor(inputTokens * (2 + Math.random())),
        latency: Math.floor(Math.random() * 1000) + 200
    };
}

export const logInference = mutation({
  args: { 
    prompt: v.string(), 
    apiKey: v.string()
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();
    const llmResponse = await callTargetLLM(args.apiKey, args.prompt);

    const efficiencyRatio = llmResponse.inputTokens / (llmResponse.outputTokens || 1);
    const wasteIndex = Math.max(0, 1 - efficiencyRatio);
    
    await ctx.db.insert("metrics", {
      timestamp,
      efficiencyRatio,
      semanticDrift: Math.random(),
      wasteIndex,
      hallucinationProb: Math.random() * 0.05,
      targetModel: "gpt-4-turbo"
    });

    await ctx.db.insert("raw_logs", {
        timestamp,
        prompt: args.prompt,
        response: "[Simulated Response]",
        inputTokens: llmResponse.inputTokens,
        outputTokens: llmResponse.outputTokens,
        model: "gpt-4-turbo",
        isAdversarial: false
    });
  }
});

export const getLive = query({
  handler: async (ctx) => {
    const metric = await ctx.db.query("metrics").order("desc").first();
    if (!metric) return null;
    const inputTokens = Math.floor(100 / (metric.efficiencyRatio || 1));
    return {
      ...metric,
      inputTokens,
      outputTokens: Math.floor(inputTokens * (1 - metric.wasteIndex))
    };
  }
});

export const getRecent = query({
  handler: async (ctx) => {
    const logs = await ctx.db.query("system_logs").order("desc").take(10);
    return logs.reverse();
  }
});