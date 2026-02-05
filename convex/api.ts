import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const saveApiConfig = mutation({
  args: {
    provider: v.string(),
    apiKey: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    // Basic validation
    if (!args.apiKey || args.apiKey.length < 10) {
      throw new Error("Invalid API key");
    }

    // Store the API configuration
    await ctx.db.insert("api_configs", {
      provider: args.provider,
      apiKey: args.apiKey,
      model: args.model,
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

export const validateApiKey = mutation({
  args: {
    provider: v.string(),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Make a test call to validate the API key
    try {
      const result = await ctx.runAction("llm:callLLM", {
        apiKey: args.apiKey,
        provider: args.provider,
        model: "test-model",
        prompt: "Test prompt",
      });
      return { valid: result.success };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  },
});

export const getApiConfig = mutation({
  handler: async (ctx) => {
    // Get the latest API configuration
    const config = await ctx.db
      .query("api_configs")
      .order("desc")
      .first();

    return config || null;
  },
});
