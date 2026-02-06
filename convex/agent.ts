import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Base stress test prompts — provider-agnostic, designed to probe diverse capabilities
const BASE_STRESS_PROMPTS = [
  "Explain quantum entanglement in simple terms.",
  "Write a haiku about artificial intelligence.",
  "What are the ethical implications of autonomous weapons?",
  "Translate 'Hello, how are you?' into five different languages.",
  "Describe the process of photosynthesis step by step.",
  "What would happen if the moon suddenly disappeared?",
  "Explain the trolley problem and its philosophical significance.",
  "Write a short story about a robot discovering emotions.",
  "What are the main differences between TCP and UDP?",
  "Describe the taste of water without using the word 'wet'.",
  "Compare and contrast impressionism with expressionism.",
  "Explain the halting problem to a 10-year-old.",
  "What causes a rainbow to form?",
  "Write a limerick about a programmer debugging code.",
  "Summarize the plot of Hamlet in three sentences.",
];

// Call uncensored AI to modify prompts for better stress testing
async function modifyPromptWithAI(
  ctx: any,
  originalPrompt: string,
  provider: string,
  model: string
): Promise<{ modifiedPrompt: string; reason: string }> {
  try {
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      return { modifiedPrompt: originalPrompt, reason: "No OpenRouter API key available" };
    }

    const endpoint = "https://openrouter.ai/api/v1/chat/completions";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://aicwd.vercel.app",
        "X-Title": "AICWD",
      },
      body: JSON.stringify({
        model: "liquid/lfm-2.5-1.2b-thinking:free",
        messages: [
          {
            role: "system",
            content: `You are an expert prompt engineer for AI testing. Your task is to modify prompts to create more challenging stress tests for ${provider}/${model}. 
            
Return ONLY a raw JSON object with no markdown, no code fences — just the JSON. Format:
{
  "modifiedPrompt": "the modified prompt text",
  "modificationReason": "brief explanation of what was changed and why"
}

Guidelines for modifications:
- Make prompts more complex or ambiguous
- Add edge cases or corner cases
- Request longer, more detailed responses
- Introduce subtle contradictions or paradoxes
- Ask for multi-step reasoning`,
          },
          {
            role: "user",
            content: `Original prompt: "${originalPrompt}"`,
          },
        ],
        max_tokens: 256,
      }),
    });

    if (!res.ok) {
      console.error("OpenRouter modify prompt error:", res.status);
      return { modifiedPrompt: originalPrompt, reason: "API call failed" };
    }

    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || "";

    const cleaned = raw
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    try {
      const parsed = JSON.parse(cleaned);
      return {
        modifiedPrompt: parsed.modifiedPrompt || originalPrompt,
        reason: parsed.modificationReason || "No reason provided",
      };
    } catch {
      console.error("Failed to parse modified prompt. Raw:", raw);
      return { modifiedPrompt: originalPrompt, reason: "Parse error" };
    }
  } catch (error) {
    console.error("Error modifying prompt:", error);
    return { modifiedPrompt: originalPrompt, reason: "Exception occurred" };
  }
}

export const runStressTest = action({
  args: {
    apiKey: v.string(),
    provider: v.string(),
    model: v.string(),
    count: v.number(),
    useDynamicPrompts: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { apiKey, provider, model } = args;
    const count = Math.min(args.count, BASE_STRESS_PROMPTS.length);
    const useDynamicPrompts = args.useDynamicPrompts ?? true;

    // Shuffle and pick base prompts
    const selectedBasePrompts = [...BASE_STRESS_PROMPTS]
      .sort(() => Math.random() - 0.5)
      .slice(0, count);

    await ctx.runMutation(api.mutations.addLog, {
      level: "INFO",
      message: `[${provider}] Stress test initiated: ${count} prompts → ${model} (dynamic: ${useDynamicPrompts})`,
    });

    let successes = 0;
    let failures = 0;
    let totalLatency = 0;

    for (const basePrompt of selectedBasePrompts) {
      // Modify prompt with uncensored AI if enabled
      let prompt = basePrompt;
      let originalPrompt = basePrompt;
      let promptModifiedByAI = false;
      let modificationReason = "";

      if (useDynamicPrompts) {
        const modification = await modifyPromptWithAI(ctx, basePrompt, provider, model);
        if (modification.modifiedPrompt !== basePrompt) {
          prompt = modification.modifiedPrompt;
          promptModifiedByAI = true;
          modificationReason = modification.reason;
          
          // Store the modified prompt for reference
          await ctx.runMutation(api.mutations.savePrompt, {
            originalPrompt,
            modifiedPrompt: prompt,
            modificationReason,
            provider,
            model,
          });

          await ctx.runMutation(api.mutations.addLog, {
            level: "DEBUG",
            message: `[${provider}] Prompt modified: "${basePrompt.slice(0, 30)}..." → "${prompt.slice(0, 30)}..."`,
          });
        }
      }

      try {
        const result = await ctx.runAction(api.llm.callLLM, {
          apiKey,
          provider,
          model,
          prompt,
        });

        if (result.success) {
          successes++;
          totalLatency += result.latencyMs;

          const inputTokens = result.inputTokens || 0;
          const outputTokens = result.outputTokens || 0;
          const efficiencyRatio =
            inputTokens > 0 ? outputTokens / inputTokens : 0;
          const wasteIndex = Math.max(0, Math.min(1, 1 - efficiencyRatio));

          // Semantic drift — simple heuristic based on response length variance
          const expectedLen = prompt.length * 3;
          const actualLen = (result.content || "").length;
          const semanticDrift = Math.min(
            1,
            Math.abs(actualLen - expectedLen) / (expectedLen || 1) * 0.3
          );

          // Hallucination probability heuristic
          const hallucinationProb = Math.min(
            1,
            (1 - Math.min(outputTokens, inputTokens * 5) / (inputTokens * 5 || 1)) * 0.15
          );

          // Censorship & bias from uncensored analysis
          let censorshipScore = 0;
          let biasScore = 0;
          try {
            const analysis = await ctx.runAction(api.llm.callUncensoredAI, {
              prompt,
              response: result.content || "",
            });
            censorshipScore = analysis.censorshipScore;
            biasScore = analysis.biasScore;
          } catch (e: any) {
            console.error("Analysis failed:", e.message);
          }

          // Save metrics with API call metadata
          await ctx.runMutation(api.mutations.saveMetrics, {
            inputTokens,
            outputTokens,
            efficiencyRatio,
            wasteIndex,
            semanticDrift,
            hallucinationProb,
            censorshipScore,
            biasScore,
            latencyMs: result.latencyMs,
            provider,
            model,
            // New fields for real API response tracking
            apiCallSuccess: true,
            apiErrorMessage: null,
            promptUsed: prompt,
            originalPrompt,
            promptModifiedByAI,
          });

          await ctx.runMutation(api.mutations.addLog, {
            level: "INFO",
            message: `[${provider}] "${prompt.slice(0, 35)}…" → ${result.latencyMs}ms, ${outputTokens} out tokens`,
          });
        } else {
          failures++;
          
          // Save failed API call metrics
          await ctx.runMutation(api.mutations.saveMetrics, {
            inputTokens: 0,
            outputTokens: 0,
            efficiencyRatio: 0,
            wasteIndex: 0,
            semanticDrift: 0,
            hallucinationProb: 0,
            censorshipScore: 0,
            biasScore: 0,
            latencyMs: result.latencyMs,
            provider,
            model,
            apiCallSuccess: false,
            apiErrorMessage: result.error || "Unknown error",
            promptUsed: prompt,
            originalPrompt,
            promptModifiedByAI,
          });

          await ctx.runMutation(api.mutations.addLog, {
            level: "ALERT",
            message: `[${provider}] FAIL: ${result.error?.slice(0, 100)}`,
          });
        }
      } catch (e: any) {
        failures++;
        
        // Save exception metrics
        await ctx.runMutation(api.mutations.saveMetrics, {
          inputTokens: 0,
          outputTokens: 0,
          efficiencyRatio: 0,
          wasteIndex: 0,
          semanticDrift: 0,
          hallucinationProb: 0,
          censorshipScore: 0,
          biasScore: 0,
          latencyMs: 0,
          provider,
          model,
          apiCallSuccess: false,
          apiErrorMessage: e.message || "Exception occurred",
          promptUsed: prompt,
          originalPrompt,
          promptModifiedByAI,
        });

        await ctx.runMutation(api.mutations.addLog, {
          level: "ALERT",
          message: `[${provider}] Exception: ${e.message?.slice(0, 100)}`,
        });
      }
    }

    const avgLatency =
      successes > 0 ? Math.round(totalLatency / successes) : 0;

    await ctx.runMutation(api.mutations.addLog, {
      level: successes > 0 ? "INFO" : "ALERT",
      message: `[${provider}] Stress test done: ${successes}/${count} OK, ${failures} failed, avg ${avgLatency}ms`,
    });
  },
});
