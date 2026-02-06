import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Parse SDK snippet to extract provider, API key, and model
function parseSDKSnippet(snippet: string): {
  provider: string | null;
  apiKey: string | null;
  model: string | null;
  config: Record<string, any>;
} {
  const result = {
    provider: null as string | null,
    apiKey: null as string | null,
    model: null as string | null,
    config: {} as Record<string, any>,
  };

  // Normalize snippet
  const normalized = snippet.replace(/\\n/g, "\n").trim();

  // Detect provider from imports or class instantiation
  const providerPatterns = [
    { pattern: /from\s+['"]openai['"]/i, provider: "openai" },
    { pattern: /from\s+['"]anthropic['"]/i, provider: "anthropic" },
    { pattern: /from\s+['"]google\.generativeai['"]/i, provider: "google" },
    { pattern: /from\s+['"]groq['"]/i, provider: "groq" },
    { pattern: /from\s+['"]mistralai['"]/i, provider: "mistral" },
    { pattern: /from\s+['"]cohere['"]/i, provider: "cohere" },
    { pattern: /from\s+['"]together['"]/i, provider: "together" },
    { pattern: /import\s+.*Bytez/i, provider: "bytez" },
    { pattern: /from\s+['"]replicate['"]/i, provider: "replicate" },
    { pattern: /from\s+['"]xai['"]/i, provider: "xai" },
    { pattern: /OpenAI\s*\(/i, provider: "openai" },
    { pattern: /Anthropic\s*\(/i, provider: "anthropic" },
    { pattern: /Groq\s*\(/i, provider: "groq" },
    { pattern: /Mistral\s*\(/i, provider: "mistral" },
    { pattern: /Cohere\s*\(/i, provider: "cohere" },
    { pattern: /Together\s*\(/i, provider: "together" },
    { pattern: /Bytez\s*\(/i, provider: "bytez" },
    { pattern: /Replicate\s*\(/i, provider: "replicate" },
    { pattern: /XAI\s*\(/i, provider: "xai" },
  ];

  for (const { pattern, provider } of providerPatterns) {
    if (pattern.test(normalized)) {
      result.provider = provider;
      break;
    }
  }

  // Extract API key
  const apiKeyPatterns = [
    /api_key\s*=\s*["']([^"']+)["']/i,
    /apiKey\s*:\s*["']([^"']+)["']/i,
    /api_key\s*:\s*["']([^"']+)["']/i,
    /OPENAI_API_KEY\s*=\s*["']([^"']+)["']/i,
    /ANTHROPIC_API_KEY\s*=\s*["']([^"']+)["']/i,
    /GROQ_API_KEY\s*=\s*["']([^"']+)["']/i,
    /COHERE_API_KEY\s*=\s*["']([^"']+)["']/i,
    /key\s*=\s*["']([^"']+)["']/i,
    /Authorization.*Bearer\s+([a-zA-Z0-9_-]+)/i,
  ];

  for (const pattern of apiKeyPatterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      result.apiKey = match[1];
      break;
    }
  }

  // Extract model
  const modelPatterns = [
    /model\s*=\s*["']([^"']+)["']/i,
    /model\s*:\s*["']([^"']+)["']/i,
    /["'](gpt-[a-z0-9-]+)["']/i,
    /["'](claude-[a-z0-9-]+)["']/i,
    /["'](gemini-[a-z0-9-]+)["']/i,
    /["'](llama-[a-z0-9-]+)["']/i,
    /["'](mixtral-[a-z0-9-]+)["']/i,
    /["'](grok-[a-z0-9-]+)["']/i,
    /["'](command-[a-z0-9-]+)["']/i,
    /["'](deepseek-[a-z0-9-]+)["']/i,
  ];

  for (const pattern of modelPatterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      result.model = match[1];
      break;
    }
  }

  // Extract additional config
  const baseUrlMatch = normalized.match(/base_url\s*[=:]\s*["']([^"']+)["']/i);
  if (baseUrlMatch) {
    result.config.baseUrl = baseUrlMatch[1];
  }

  const maxTokensMatch = normalized.match(/max_tokens\s*[=:]\s*(\d+)/i);
  if (maxTokensMatch) {
    result.config.maxTokens = parseInt(maxTokensMatch[1], 10);
  }

  const temperatureMatch = normalized.match(/temperature\s*[=:]\s*([\d.]+)/i);
  if (temperatureMatch) {
    result.config.temperature = parseFloat(temperatureMatch[1]);
  }

  return result;
}

// Validate parsed SDK configuration
function validateSDKConfig(config: ReturnType<typeof parseSDKSnippet>): {
  valid: boolean;
  error?: string;
} {
  if (!config.apiKey) {
    return { valid: false, error: "Could not extract API key from SDK snippet" };
  }
  if (!config.provider) {
    return { valid: false, error: "Could not detect provider from SDK snippet" };
  }
  if (config.apiKey.length < 10) {
    return { valid: false, error: "API key appears too short" };
  }
  return { valid: true };
}

export const saveApiConfig = mutation({
  args: {
    provider: v.string(),
    apiKey: v.string(),
    model: v.string(),
    // Optional SDK-style fields
    inputType: v.optional(v.string()),
    sdkSnippet: v.optional(v.string()),
    sdkProvider: v.optional(v.string()),
    sdkModel: v.optional(v.string()),
    sdkParsedConfig: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Basic validation
    if (!args.apiKey || args.apiKey.length < 10) {
      throw new Error("Invalid API key");
    }

    // Store the API configuration with SDK support
    await ctx.db.insert("api_configs", {
      provider: args.provider,
      apiKey: args.apiKey,
      model: args.model,
      timestamp: Date.now(),
      inputType: args.inputType || "apiKey",
      sdkSnippet: args.sdkSnippet,
      sdkProvider: args.sdkProvider,
      sdkModel: args.sdkModel,
      sdkParsedConfig: args.sdkParsedConfig,
    });

    return { success: true };
  },
});

export const parseAndValidateSDK = mutation({
  args: {
    sdkSnippet: v.string(),
  },
  handler: async (ctx, args) => {
    const parsed = parseSDKSnippet(args.sdkSnippet);
    const validation = validateSDKConfig(parsed);

    return {
      parsed,
      validation,
    };
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
      return { valid: false, error: (error as Error).message };
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
