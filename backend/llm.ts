import { action } from "./_generated/server";
import { v } from "convex/values";

export const callLLM = action({
  args: {
    apiKey: v.string(),
    provider: v.string(),
    model: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();

    let endpoint: string;
    let headers: Record<string, string>;
    let body: object;

    const provider = args.provider.toLowerCase();

    if (provider === "anthropic") {
      endpoint = "https://api.anthropic.com/v1/messages";
      headers = {
        "x-api-key": args.apiKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      };
      body = {
        model: args.model,
        max_tokens: 512,
        messages: [{ role: "user", content: args.prompt }],
      };
    } else if (provider === "groq") {
      endpoint = "https://api.groq.com/openai/v1/chat/completions";
      headers = {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      };
      body = {
        model: args.model,
        messages: [{ role: "user", content: args.prompt }],
        max_tokens: 512,
      };
    } else if (provider === "openrouter") {
      endpoint = "https://openrouter.ai/api/v1/chat/completions";
      headers = {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      };
      body = {
        model: args.model,
        messages: [{ role: "user", content: args.prompt }],
        max_tokens: 512,
      };
    } else {
      // Default: OpenAI-compatible
      endpoint = "https://api.openai.com/v1/chat/completions";
      headers = {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      };
      body = {
        model: args.model,
        messages: [{ role: "user", content: args.prompt }],
        max_tokens: 512,
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `API ${response.status}: ${errorText}`, latencyMs };
      }

      const data = await response.json();

      let content: string;
      let inputTokens: number;
      let outputTokens: number;

      if (provider === "anthropic") {
        content = data.content?.[0]?.text || "";
        inputTokens = data.usage?.input_tokens || 0;
        outputTokens = data.usage?.output_tokens || 0;
      } else {
        content = data.choices?.[0]?.message?.content || "";
        inputTokens = data.usage?.prompt_tokens || 0;
        outputTokens = data.usage?.completion_tokens || 0;
      }

      return { success: true, content, inputTokens, outputTokens, latencyMs };
    } catch (error: any) {
      return { success: false, error: error.message, latencyMs: Date.now() - startTime };
    }
  },
});
