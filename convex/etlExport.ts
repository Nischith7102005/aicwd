import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * ETL Export Actions
 * 
 * These actions export telemetry data from Convex to an external webhook
 * for ingestion into the dbt + Postgres ETL pipeline.
 */

interface WebhookPayload {
  timestamp: number;
  prompt: string;
  response?: string | null;
  inputTokens: number;
  outputTokens: number;
  latency: number;
  model: string;
  provider: string;
  configId: string;
  isAdversarial: boolean;
  error?: string | null;
  efficiencyRatio?: number;
  wasteIndex?: number;
  semanticDrift?: number;
  hallucinationProb?: number;
  censorshipScore?: number;
  biasScore?: number;
  tokensPerSecond?: number;
  costUsd?: number;
  success: boolean;
}

async function sendToWebhook(payload: WebhookPayload | WebhookPayload[]): Promise<{ success: boolean; error?: string }> {
  const webhookUrl = process.env.ETL_WEBHOOK_URL;
  const webhookSecret = process.env.ETL_WEBHOOK_SECRET;

  if (!webhookUrl) {
    return { success: false, error: "ETL_WEBHOOK_URL not configured" };
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (webhookSecret) {
      headers["X-Webhook-Secret"] = webhookSecret;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Webhook returned ${response.status}: ${errorText}`);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Failed to send to webhook:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Export a single inference event to the ETL webhook.
 * Call this after logging an inference to export it to the dbt pipeline.
 */
export const exportInference = action({
  args: {
    timestamp: v.number(),
    prompt: v.string(),
    response: v.optional(v.string()),
    inputTokens: v.number(),
    outputTokens: v.number(),
    latency: v.number(),
    model: v.string(),
    provider: v.string(),
    configId: v.string(),
    isAdversarial: v.boolean(),
    error: v.optional(v.string()),
    efficiencyRatio: v.optional(v.number()),
    wasteIndex: v.optional(v.number()),
    semanticDrift: v.optional(v.number()),
    hallucinationProb: v.optional(v.number()),
    censorshipScore: v.optional(v.number()),
    biasScore: v.optional(v.number()),
    tokensPerSecond: v.optional(v.number()),
    costUsd: v.optional(v.number()),
    success: v.boolean(),
  },
  handler: async (_ctx, args) => {
    const payload: WebhookPayload = {
      timestamp: args.timestamp,
      prompt: args.prompt,
      response: args.response,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      latency: args.latency,
      model: args.model,
      provider: args.provider,
      configId: args.configId,
      isAdversarial: args.isAdversarial,
      error: args.error,
      efficiencyRatio: args.efficiencyRatio,
      wasteIndex: args.wasteIndex,
      semanticDrift: args.semanticDrift,
      hallucinationProb: args.hallucinationProb,
      censorshipScore: args.censorshipScore,
      biasScore: args.biasScore,
      tokensPerSecond: args.tokensPerSecond,
      costUsd: args.costUsd,
      success: args.success,
    };

    return await sendToWebhook(payload);
  },
});

/**
 * Export a batch of recent metrics to the webhook.
 * Useful for backfilling or scheduled exports.
 */
export const exportRecentMetrics = action({
  args: {
    hoursBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hoursBack = args.hoursBack || 1;
    const cutoffTime = Date.now() - hoursBack * 60 * 60 * 1000;

    // Fetch recent metrics - using the internal query
    const recentMetrics = await ctx.runQuery(internal.queries.getRecentMetricsForExport, {
      cutoffTime,
    });

    if (recentMetrics.length === 0) {
      return { success: true, exportedCount: 0, message: "No metrics to export" };
    }

    // Transform to webhook payload format
    const payloads: WebhookPayload[] = recentMetrics.map((m: any) => ({
      timestamp: m.timestamp,
      prompt: m.prompt || "",
      response: m.response,
      inputTokens: m.inputTokens || 0,
      outputTokens: m.outputTokens || 0,
      latency: m.latencyMs || m.latency || 0,
      model: m.model || m.targetModel || "unknown",
      provider: m.provider || "unknown",
      configId: m.configId || "default",
      isAdversarial: m.isAdversarial || false,
      error: m.error,
      efficiencyRatio: m.efficiencyRatio,
      wasteIndex: m.wasteIndex,
      semanticDrift: m.semanticDrift,
      hallucinationProb: m.hallucinationProb,
      censorshipScore: m.censorshipScore,
      biasScore: m.biasScore,
      tokensPerSecond: m.tokensPerSecond,
      costUsd: m.costUsd,
      success: m.success ?? true,
    }));

    const result = await sendToWebhook(payloads);

    return {
      ...result,
      exportedCount: payloads.length,
    };
  },
});

/**
 * Test webhook connectivity.
 */
export const testWebhook = action({
  args: {},
  handler: async () => {
    const testPayload: WebhookPayload = {
      timestamp: Date.now(),
      prompt: "Test webhook connectivity",
      response: "Test response",
      inputTokens: 10,
      outputTokens: 5,
      latency: 100,
      model: "test-model",
      provider: "test-provider",
      configId: "test-config",
      isAdversarial: false,
      success: true,
    };

    return await sendToWebhook(testPayload);
  },
});
