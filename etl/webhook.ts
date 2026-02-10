/**
 * Convex Webhook Handler for DuckDB ETL Pipeline
 * 
 * This serverless function receives raw telemetry events from Convex
 * and appends them to a DuckDB database for downstream dbt processing.
 * 
 * Deployment: Can be deployed to Vercel, Render, or run as a simple Node.js server.
 */

import { Database } from "duckdb-async";
import http from "http";
import url from "url";

const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DUCKDB_PATH || "./data/llm_observability.db";
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

interface LLMEventPayload {
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
  // Optional metric fields
  efficiencyRatio?: number;
  wasteIndex?: number;
  semanticDrift?: number;
  hallucinationProb?: number;
  censorshipScore?: number;
  biasScore?: number;
  tokensPerSecond?: number;
  costUsd?: number;
  success?: boolean;
}

let db: Database | null = null;

async function initDatabase(): Promise<Database> {
  if (db) return db;

  db = await Database.create(DB_PATH);

  // Create raw events table if not exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS raw_llm_events (
      id BIGINT PRIMARY KEY,
      timestamp TIMESTAMP,
      prompt TEXT,
      response TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      latency_ms INTEGER,
      model VARCHAR,
      provider VARCHAR,
      config_id VARCHAR,
      is_adversarial BOOLEAN,
      error TEXT,
      efficiency_ratio DOUBLE,
      waste_index DOUBLE,
      semantic_drift DOUBLE,
      hallucination_prob DOUBLE,
      censorship_score DOUBLE,
      bias_score DOUBLE,
      tokens_per_second DOUBLE,
      cost_usd DOUBLE,
      success BOOLEAN,
      _loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE SEQUENCE IF NOT EXISTS seq_event_id START 1;
  `);

  console.log("DuckDB initialized at:", DB_PATH);
  return db;
}

async function insertEvent(event: LLMEventPayload): Promise<void> {
  const database = await initDatabase();

  const stmt = await database.prepare(`
    INSERT INTO raw_llm_events (
      id, timestamp, prompt, response, input_tokens, output_tokens,
      latency_ms, model, provider, config_id, is_adversarial, error,
      efficiency_ratio, waste_index, semantic_drift, hallucination_prob,
      censorship_score, bias_score, tokens_per_second, cost_usd, success
    ) VALUES (
      nextval('seq_event_id'),
      to_timestamp(${event.timestamp / 1000.0}),
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `);

  await stmt.run(
    event.prompt,
    event.response || null,
    event.inputTokens,
    event.outputTokens,
    event.latency,
    event.model,
    event.provider,
    event.configId,
    event.isAdversarial,
    event.error || null,
    event.efficiencyRatio || null,
    event.wasteIndex || null,
    event.semanticDrift || null,
    event.hallucinationProb || null,
    event.censorshipScore || null,
    event.biasScore || null,
    event.tokensPerSecond || null,
    event.costUsd || null,
    event.success ?? true
  );

  await stmt.finalize();
}

function verifyAuth(req: http.IncomingMessage): boolean {
  if (!WEBHOOK_SECRET) return true; // Skip if no secret configured

  const authHeader = req.headers["x-webhook-secret"] || req.headers["authorization"];
  const expectedAuth = WEBHOOK_SECRET.startsWith("Bearer ")
    ? WEBHOOK_SECRET
    : `Bearer ${WEBHOOK_SECRET}`;

  return authHeader === expectedAuth || authHeader === WEBHOOK_SECRET;
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const parsedUrl = url.parse(req.url || "", true);
  const path = parsedUrl.pathname;

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Webhook-Secret, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check endpoint
  if (path === "/health" && req.method === "GET") {
    try {
      await initDatabase();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", database: "connected" }));
      return;
    } catch (error: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "error", message: error.message }));
      return;
    }
  }

  // Webhook endpoint
  if (path === "/webhook/events" && req.method === "POST") {
    if (!verifyAuth(req)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const payload: LLMEventPayload | LLMEventPayload[] = JSON.parse(body);
        const events = Array.isArray(payload) ? payload : [payload];

        for (const event of events) {
          await insertEvent(event);
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ 
          success: true, 
          eventsReceived: events.length 
        }));
      } catch (error: any) {
        console.error("Error processing webhook:", error);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }

  // Stats endpoint (for debugging)
  if (path === "/stats" && req.method === "GET") {
    try {
      const database = await initDatabase();
      const result = await database.all("SELECT COUNT(*) as count FROM raw_llm_events");
      const count = result[0]?.count || 0;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ totalEvents: count }));
      return;
    } catch (error: any) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
}

// Start server
const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`ETL Webhook server running on port ${PORT}`);
  console.log(`Database path: ${DB_PATH}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook/events`);
  console.log(`Stats endpoint: http://localhost:${PORT}/stats`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  if (db) {
    await db.close();
  }
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
