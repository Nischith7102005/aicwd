import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const runInference = action({
  args: {
    apiKey: v.string(),
    provider: v.string(),
    model: v.string(),
    prompt: v.string(),
    isAdversarial: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Call the LLM
    const result = await ctx.runAction(internal.llm.callLLM, {
      apiKey: args.apiKey,
      provider: args.provider,
      model: args.model,
      prompt: args.prompt,
    });

    if (!result.success) {
      await ctx.runMutation(internal.metrics.addLog, {
        level: "ALERT",
        message: `LLM Error: ${result.error}`,
      });
      return { success: false, error: result.error };
    }

    // Call the uncensored AI to analyze the response
    const analysis = await ctx.runAction(internal.llm.callUncensoredAI, {
      prompt: args.prompt,
      response: result.content,
    });

    // Store and compute metrics
    const metrics = await ctx.runMutation(internal.metrics.storeInference, {
      prompt: args.prompt,
      response: result.content,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      latencyMs: result.latencyMs,
      model: args.model,
      isAdversarial: args.isAdversarial || false,
      censorshipScore: analysis.censorshipScore,
      biasScore: analysis.biasScore,
    });

    return { success: true, response: result.content, metrics };
  },
});
