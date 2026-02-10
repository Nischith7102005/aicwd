# monitr-ai ETL Pipeline

This directory contains the dbt Core + DuckDB ETL pipeline for the monitr-ai LLM observability platform.

## Overview

The ETL pipeline processes raw LLM telemetry data from Convex through a webhook ingestion layer, transforms it using dbt models, and produces analytics-ready datasets.

## Architecture

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Convex     │──────▶  Webhook     │──────▶   DuckDB     │──────▶   dbt        │
│  Database    │      │   Handler    │      │  Database    │      │  Models      │
└──────────────┘      └──────────────┘      └──────────────┘      └──────────────┘
                                                          │
                                                          ▼
                                              ┌───────────────────┐
                                              │  Analytics Marts  │
                                              │  - Daily Metrics  │
                                              │  - Waste Index    │
                                              │  - Provider Comp  │
                                              └───────────────────┘
```

## Components

### 1. Webhook Handler (`webhook.ts`)

A lightweight HTTP server that receives events from Convex and stores them in DuckDB.

**Endpoints:**
- `POST /webhook/events` - Receive telemetry events
- `GET /health` - Health check
- `GET /stats` - Event count statistics

**Environment Variables:**
```bash
PORT=3001
DUCKDB_PATH=./data/llm_observability.db
WEBHOOK_SECRET=your-secret
```

### 2. dbt Project

**Models:**
- `staging/stg_llm_events` - Cleaned and enriched raw events
- `staging/stg_models` - Model dimension table
- `marts/daily_metrics` - Daily aggregated metrics
- `marts/cognitive_waste_index` - Comprehensive waste scoring
- `marts/provider_comparison` - Cross-provider analysis

### 3. GitHub Actions Workflow (`.github/workflows/dbt.yml`)

Runs dbt on a schedule (hourly) and on manual trigger.

## Setup

### 1. Install Dependencies

```bash
cd etl
pip install dbt-duckdb duckdb
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Run dbt

```bash
dbt deps      # Install dbt packages
dbt seed      # Load seeds (if any)
dbt run       # Run models
dbt test      # Run tests
dbt docs generate  # Generate documentation
dbt docs serve     # Serve docs locally
```

## Deployment

### Webhook Handler Options

**Option A: Vercel Serverless Function**
```bash
# Deploy webhook.ts as a Vercel function
vercel --prod
```

**Option B: Render/Railway**
Deploy as a Node.js service with the start command:
```bash
ts-node webhook.ts
```

**Option C: Self-hosted**
```bash
npx ts-node webhook.ts
```

### Convex Configuration

Add environment variables in Convex dashboard:
- `ETL_WEBHOOK_URL` - Your webhook endpoint URL
- `ETL_WEBHOOK_SECRET` - Shared secret for authentication

## Data Schema

### Raw Events (`raw_llm_events`)

| Column | Type | Description |
|--------|------|-------------|
| id | BIGINT | Auto-incrementing ID |
| timestamp | TIMESTAMP | Event timestamp |
| prompt | TEXT | User prompt |
| response | TEXT | LLM response |
| input_tokens | INTEGER | Input token count |
| output_tokens | INTEGER | Output token count |
| latency_ms | INTEGER | Request latency |
| model | VARCHAR | Model identifier |
| provider | VARCHAR | LLM provider |
| config_id | VARCHAR | Convex config ID |
| is_adversarial | BOOLEAN | Adversarial test flag |
| error | TEXT | Error message |
| efficiency_ratio | DOUBLE | Output/Input ratio |
| waste_index | DOUBLE | Cognitive waste (0-1) |
| semantic_drift | DOUBLE | Semantic drift (0-1) |
| hallucination_prob | DOUBLE | Hallucination risk (0-1) |
| censorship_score | DOUBLE | Censorship score (0-1) |
| bias_score | DOUBLE | Bias score (0-1) |
| _loaded_at | TIMESTAMP | Ingestion timestamp |

## Testing

### Manual Webhook Test

```bash
curl -X POST http://localhost:3001/webhook/events \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-secret" \
  -d '{
    "timestamp": 1234567890000,
    "prompt": "Test prompt",
    "response": "Test response",
    "inputTokens": 10,
    "outputTokens": 5,
    "latency": 100,
    "model": "gpt-4",
    "provider": "openai",
    "configId": "test",
    "isAdversarial": false,
    "success": true
  }'
```

### Convex Export Test

```bash
npx convex run etlExport:testWebhook
```

## Monitoring

- GitHub Actions runs: Check the Actions tab
- dbt artifacts: Download from workflow runs
- Database: Artifact uploaded after each run
