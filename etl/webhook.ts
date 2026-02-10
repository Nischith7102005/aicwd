/**
 * Convex Webhook Handler for Postgres ETL Pipeline
 *
 * This serverless function receives raw telemetry events from Convex
 * and appends them to a Postgres database for downstream dbt processing.
 *
 * Deployment: Can be deployed to Vercel, Render, or run as a simple Node.js server.
 */

import { Pool, PoolClient } from "pg";
import http from "http";
import url from "url";

const PORT = process.env.PORT || 3001;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

// Postgres connection - uses DATABASE_URL or individual PG* vars
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST,
  port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl:
    process.env.PGSSLMODE === "require" || process.env.DATABASE_URL?.includes("sslmode=require")
      ? { rejectUnauthorized: false }
      : undefined,
});

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

let isInitialized = false;

async function initDatabase(): Promise<void> {
  if (isInitialized) return;

  const client = await pool.connect();
  try {
    // Create raw events table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS raw_llm_events (
        id BIGSERIAL PRIMARY KEY,
        timestamp TIMESTAMP,
        prompt TEXT,
        response TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        latency_ms INTEGER,
        model VARCHAR(255),
        provider VARCHAR(255),
        config_id VARCHAR(255),
        is_adversarial BOOLEAN,
        error TEXT,
        efficiency_ratio DOUBLE PRECISION,
        waste_index DOUBLE PRECISION,
        semantic_drift DOUBLE PRECISION,
        hallucination_prob DOUBLE PRECISION,
        censorship_score DOUBLE PRECISION,
        bias_score DOUBLE PRECISION,
        tokens_per_second DOUBLE PRECISION,
        cost_usd DOUBLE PRECISION,
        success BOOLEAN,
        _loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create index on timestamp for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_raw_llm_events_timestamp 
      ON raw_llm_events(timestamp)
    `);

    // Create index on _loaded_at for incremental processing
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_raw_llm_events_loaded_at 
      ON raw_llm_events(_loaded_at)
    `);

    isInitialized = true;
    console.log("Postgres initialized successfully");
  } finally {
    client.release();
  }
}

async function insertEvent(event: LLMEventPayload): Promise<void> {
  await initDatabase();

  const query = `
    INSERT INTO raw_llm_events (
      timestamp, prompt, response, input_tokens, output_tokens,
      latency_ms, model, provider, config_id, is_adversarial, error,
      efficiency_ratio, waste_index, semantic_drift, hallucination_prob,
      censorship_score, bias_score, tokens_per_second, cost_usd, success
    ) VALUES (
      to_timestamp($1 / 1000.0),
      $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
    )
  `;

  const values = [
    event.timestamp,
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
    event.success ?? true,
  ];

  await pool.query(query, values);
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
        res.end(
          JSON.stringify({
            success: true,
            eventsReceived: events.length,
          })
        );
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
      await initDatabase();
      const result = await pool.query("SELECT COUNT(*) as count FROM raw_llm_events");
      const count = parseInt(result.rows[0]?.count || "0", 10);

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
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/webhook/events`);
  console.log(`Stats endpoint: http://localhost:${PORT}/stats`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully");
  await pool.end();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully");
  await pool.end();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
