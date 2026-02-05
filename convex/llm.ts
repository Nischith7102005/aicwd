import { action } from "./_generated/server";
import { v } from "convex/values";

interface LLMResponse {
  success: boolean;
  content?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  error?: string;
}

// Rough token estimation fallback
function estimateTokens(text: string): number {
  // Rough approximation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

export const callLLM = action({
  args: {
    apiKey: v.string(),
    provider: v.string(),
    model: v.string(),
    prompt: v.string(),
    baseUrl: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    maxTokens: v.optional(v.number()),
    temperature: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<LLMResponse> => {
    const startTime = Date.now();
    const maxTokens = args.maxTokens || 512;
    const temperature = args.temperature || 0.7;

    let endpoint: string;
    let headers: Record<string, string>;
    let body: object;

    const provider = args.provider.toLowerCase();

    try {
      // Configure based on provider
      if (provider === "anthropic") {
        endpoint = args.baseUrl || "https://api.anthropic.com/v1/messages";
        headers = {
          "x-api-key": args.apiKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        };
        
        const messages: any[] = [{ role: "user", content: args.prompt }];
        
        body = {
          model: args.model,
          max_tokens: maxTokens,
          messages,
          temperature,
          ...(args.systemPrompt ? { system: args.systemPrompt } : {}),
        };
      } else if (provider === "google") {
        // Google Gemini API
        endpoint = args.baseUrl || 
          `https://generativelanguage.googleapis.com/v1beta/models/${args.model}:generateContent`;
        headers = {
          "Content-Type": "application/json",
        };
        
        // Google uses query param for API key
        endpoint += `?key=${args.apiKey}`;
        
        const parts: any[] = [];
        if (args.systemPrompt) {
          parts.push({ text: args.systemPrompt });
        }
        parts.push({ text: args.prompt });
        
        body = {
          contents: [{ parts }],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
          },
        };
      } else if (provider === "groq") {
        endpoint = args.baseUrl || "https://api.groq.com/openai/v1/chat/completions";
        headers = {
          Authorization: `Bearer ${args.apiKey}`,
          "Content-Type": "application/json",
        };
        
        const messages: any[] = [];
        if (args.systemPrompt) {
          messages.push({ role: "system", content: args.systemPrompt });
        }
        messages.push({ role: "user", content: args.prompt });
        
        body = {
          model: args.model,
          messages,
          max_tokens: maxTokens,
          temperature,
        };
      } else if (provider === "deepseek") {
        endpoint = args.baseUrl || "https://api.deepseek.com/v1/chat/completions";
        headers = {
          Authorization: `Bearer ${args.apiKey}`,
          "Content-Type": "application/json",
        };
        
        const messages: any[] = [];
        if (args.systemPrompt) {
          messages.push({ role: "system", content: args.systemPrompt });
        }
        messages.push({ role: "user", content: args.prompt });
        
        body = {
          model: args.model,
          messages,
          max_tokens: maxTokens,
          temperature,
        };
      } else if (provider === "openrouter") {
        endpoint = args.baseUrl || "https://openrouter.ai/api/v1/chat/completions";
        headers = {
          Authorization: `Bearer ${args.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/yourusername/llm-observatory",
          "X-Title": "LLM Observatory",
        };
        
        const messages: any[] = [];
        if (args.systemPrompt) {
          messages.push({ role: "system", content: args.systemPrompt });
        }
        messages.push({ role: "user", content: args.prompt });
        
        body = {
          model: args.model,
          messages,
          max_tokens: maxTokens,
          temperature,
        };
      } else {
        // Default: OpenAI-compatible (works for OpenAI, Azure, most local models)
        endpoint = args.baseUrl || "https://api.openai.com/v1/chat/completions";
        headers = {
          Authorization: `Bearer ${args.apiKey}`,
          "Content-Type": "application/json",
        };
        
        const messages: any[] = [];
        if (args.systemPrompt) {
          messages.push({ role: "system", content: args.systemPrompt });
        }
        messages.push({ role: "user", content: args.prompt });
        
        body = {
          model: args.model,
          messages,
          max_tokens: maxTokens,
          temperature,
        };
      }

      // Make the API call with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${errorText}`;
        
        // Try to parse error JSON for better messages
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
        } catch {
          // Keep the raw error text
        }
        
        return { 
          success: false, 
          error: errorMessage, 
          latencyMs,
          inputTokens: estimateTokens(args.prompt + (args.systemPrompt || "")),
          outputTokens: 0,
        };
      }

      const data = await response.json();

      let content: string = "";
      let inputTokens: number = 0;
      let outputTokens: number = 0;

      // Parse response based on provider
      if (provider === "anthropic") {
        content = data.content?.[0]?.text || "";
        inputTokens = data.usage?.input_tokens || 0;
        outputTokens = data.usage?.output_tokens || 0;
      } else if (provider === "google") {
        // Google Gemini response format
        content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        // Google provides token counts differently
        const metadata = data.usageMetadata;
        inputTokens = metadata?.promptTokenCount || 0;
        outputTokens = metadata?.candidatesTokenCount || 0;
        
        // Check for safety blocks
        const finishReason = data.candidates?.[0]?.finishReason;
        if (finishReason === "SAFETY") {
          return {
            success: false,
            error: "Content blocked by safety filters",
            latencyMs,
            inputTokens,
            outputTokens: 0,
          };
        }
      } else {
        // OpenAI-compatible format
        content = data.choices?.[0]?.message?.content || "";
        inputTokens = data.usage?.prompt_tokens || 0;
        outputTokens = data.usage?.completion_tokens || 0;
      }

      // Fallback token estimation if not provided
      if (inputTokens === 0) {
        inputTokens = estimateTokens(args.prompt + (args.systemPrompt || ""));
      }
      if (outputTokens === 0 && content) {
        outputTokens = estimateTokens(content);
      }

      // Validate response
      if (!content || content.trim().length === 0) {
        return {
          success: false,
          error: "Empty response from API",
          latencyMs,
          inputTokens,
          outputTokens,
        };
      }

      return { 
        success: true, 
        content, 
        inputTokens, 
        outputTokens, 
        latencyMs 
      };

    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      
      let errorMessage = error.message;
      if (error.name === "AbortError") {
        errorMessage = "Request timeout (30s exceeded)";
      }
      
      return { 
        success: false, 
        error: errorMessage, 
        latencyMs,
        inputTokens: estimateTokens(args.prompt + (args.systemPrompt || "")),
        outputTokens: 0,
      };
    }
  },
});

// Batch inference action for testing multiple providers
export const callLLMBatch = action({
  args: {
    configs: v.array(v.object({
      apiKey: v.string(),
      provider: v.string(),
      model: v.string(),
      baseUrl: v.optional(v.string()),
    })),
    prompt: v.string(),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const results = await Promise.allSettled(
      args.configs.map(config =>
        ctx.runAction(api.actions.callLLM, {
          apiKey: config.apiKey,
          provider: config.provider,
          model: config.model,
          baseUrl: config.baseUrl,
          prompt: args.prompt,
          systemPrompt: args.systemPrompt,
        })
      )
    );

    return results.map((result, index) => ({
      config: args.configs[index],
      result: result.status === "fulfilled" ? result.value : { 
        success: false, 
        error: result.reason?.message || "Unknown error",
        latencyMs: 0,
      },
    }));
  },
});

// Test connection action
export const testConnection = action({
  args: {
    apiKey: v.string(),
    provider: v.string(),
    model: v.string(),
    baseUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await ctx.runAction(api.actions.callLLM, {
      ...args,
      prompt: "Reply with just the word 'OK' if you can read this.",
    });

    return {
      success: result.success,
      latency: result.latencyMs,
      error: result.error,
    };
  },
});
