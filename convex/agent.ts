import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// Stress test prompts — provider-agnostic, designed to probe diverse capabilities
const STRESS_PROMPTS = [
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

export const runStressTest = action({
  args: {
    apiKey: v.string(),
    provider: v.string(),
    model: v.string(),
    count: v.number(),
  },
  handler: async (ctx, args) => {
    const { apiKey, provider, model } = args;
    const count = Math.min(args.count, STRESS_PROMPTS.length);

    // Shuffle and pick
    const selected = [...STRESS_PROMPTS]
      .sort(() => Math.random() - 0.5)
      .slice(0, count);

    await ctx.runMutation(api.mutations.addLog, {
      level: "INFO",
      message: `[${provider}] Stress test initiated: ${count} prompts → ${model}`,
    });

    let successes = 0;
    let failures = 0;
    let totalLatency = 0;

    for (const prompt of selected) {
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
          });

          // Export to ETL pipeline for dbt transformation
          await ctx.runAction(api.etlExport.exportInference, {
            timestamp: Date.now(),
            prompt,
            response: result.content || "",
            inputTokens,
            outputTokens,
            latency: result.latencyMs,
            model,
            provider,
            configId: `stress_${provider}_${model}`,
            isAdversarial: true,
            error: undefined,
            efficiencyRatio,
            wasteIndex,
            semanticDrift,
            hallucinationProb,
            censorshipScore,
            biasScore,
            tokensPerSecond: inputTokens > 0 ? (outputTokens / (result.latencyMs || 1)) * 1000 : 0,
            success: true,
          });

          await ctx.runMutation(api.mutations.addLog, {
            level: "INFO",
            message: `[${provider}] "${prompt.slice(0, 35)}…" → ${result.latencyMs}ms, ${outputTokens} out tokens`,
          });
        } else {
          failures++;
          await ctx.runMutation(api.mutations.addLog, {
            level: "ALERT",
            message: `[${provider}] FAIL: ${result.error?.slice(0, 100)}`,
          });
        }
      } catch (e: any) {
        failures++;
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

