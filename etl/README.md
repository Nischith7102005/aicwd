# monitr-ai ETL Pipeline

This directory contains the dbt Core + Postgres ETL pipeline for the monitr-ai LLM observability platform.

## Overview

The ETL pipeline processes raw LLM telemetry data from Convex through a webhook ingestion layer, transforms it using dbt models, and produces analytics-ready datasets.

## Architecture

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Convex     │──────▶  Webhook     │──────▶   Postgres   │──────▶   dbt        │
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

A lightweight HTTP server that receives events from Convex and stores them in Postgres.

**Endpoints:**
- `POST /webhook/events` - Receive telemetry events
- `GET /health` - Health check
- `GET /stats` - Event count statistics

**Environment Variables:**
```bash
PORT=3001
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
# OR use individual PG* variables:
PGHOST=your-host.neon.tech
PGPORT=5432
PGDATABASE=your-database
PGUSER=your-user
PGPASSWORD=your-password
PGSSLMODE=require

WEBHOOK_SECRET=your-secret
```

### 2. dbt Project

**Models:**
- `staging/stg_llm_events` - Cleaned and enriched raw events
- `staging/stg_models` - Model dimension table
- `marts/daily_metrics` - Daily aggregated metrics
- `marts/cognitive_waste_index` - Comprehensive waste scoring
- `marts/provider_comparison` - Cross-provider analysis

**Metric lineage:**
- `metrics_lineage.md` - Raw vs transformed table inventory and metric-to-source mapping

### 3. GitHub Actions Workflow (`.github/workflows/dbt.yml`)

Runs dbt on a schedule (hourly) and on manual trigger.

## Setup

### 1. Install Dependencies

```bash
cd etl
npm install
pip install dbt-postgres
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Neon Postgres connection details
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

Set environment variables in your hosting platform:
- `DATABASE_URL` (recommended) OR individual `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`
- `WEBHOOK_SECRET`

**Option C: Self-hosted**
```bash
npx ts-node webhook.ts
```

### Convex Configuration

Add environment variables in Convex dashboard:
- `ETL_WEBHOOK_URL` - Your webhook endpoint URL
- `ETL_WEBHOOK_SECRET` - Shared secret for authentication

### Neon Postgres Setup

1. Create a new database in [Neon](https://neon.tech)
2. Get your connection string from the Neon dashboard
3. Configure environment variables with the connection details
4. The webhook will automatically create the `raw_llm_events` table on first connection

## Data Schema

### Raw Events (`raw_llm_events`)

| Column | Type | Description |
|--------|------|-------------|
| id | BIGSERIAL | Auto-incrementing ID (primary key) |
| timestamp | TIMESTAMP | Event timestamp |
| prompt | TEXT | User prompt |
| response | TEXT | LLM response |
| input_tokens | INTEGER | Input token count |
| output_tokens | INTEGER | Output token count |
| latency_ms | INTEGER | Request latency |
| model | VARCHAR(255) | Model identifier |
| provider | VARCHAR(255) | LLM provider |
| config_id | VARCHAR(255) | Convex config ID |
| is_adversarial | BOOLEAN | Adversarial test flag |
| error | TEXT | Error message |
| efficiency_ratio | DOUBLE PRECISION | Output/Input ratio |
| waste_index | DOUBLE PRECISION | Cognitive waste (0-1) |
| semantic_drift | DOUBLE PRECISION | Semantic drift (0-1) |
| hallucination_prob | DOUBLE PRECISION | Hallucination risk (0-1) |
| censorship_score | DOUBLE PRECISION | Censorship score (0-1) |
| bias_score | DOUBLE PRECISION | Bias score (0-1) |
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
- Postgres: Monitor via Neon dashboard or your Postgres provider
