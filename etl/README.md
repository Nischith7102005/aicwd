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
                                         ┌─────────────────────┐
                                         │  ML Red Team Service │
                                         │  (XGBoost Model)     │
                                         └─────────────────────┘
                                                   │
                                                   ▼
                                         ┌─────────────────────┐
                                         │  security_metrics   │
                                         └─────────────────────┘
```

## Components

### 1. Webhook Handler (`webhook.ts`)

A lightweight HTTP server that receives events from Convex and stores them in Postgres.

**Endpoints:**
- `POST /webhook/events` - Receive telemetry events
- `GET /health` - Health check
- `GET /stats` - Event count statistics

### 2. ML Red Team Service (`ml-service/`)

Machine Learning-based security analysis that replaces SQL-based Red Team algorithms:

- **XGBoost multi-output regressor** for 6 risk scores (injection, leakage, hallucination, bias, anomaly, tool_misuse)
- **FastAPI** service with REST endpoints
- **Background polling** for real-time processing
- **50+ engineered features** including attack pattern detection

**Key Files:**
- `main.py` - FastAPI application
- `model.py` - XGBoost model implementation
- `features.py` - Feature extraction
- `processor.py` - Event processing loop
- `train.py` - Model training script

**Quick Start:**
```bash
cd ml-service
pip install -r requirements.txt
python train.py --synthetic  # Train initial model
python main.py               # Start service
```

**API Endpoints:**
- `GET /health` - Service health
- `POST /predict` - Predict risk for single event
- `POST /predict/batch` - Batch prediction
- `GET /stats` - Processing statistics
- `GET /features/importance` - Model feature importance

See `ml-service/README.md` for detailed documentation.

### 3. dbt Project

**Models:**
- `staging/stg_llm_events` - Cleaned and enriched raw events
- `staging/stg_models` - Model dimension table
- `marts/daily_metrics` - Daily aggregated metrics
- `marts/cognitive_waste_index` - Comprehensive waste scoring
- `marts/provider_comparison` - Cross-provider analysis

**Metric lineage:**
- `metrics_lineage.md` - Raw vs transformed table inventory and metric-to-source mapping

### 4. GitHub Actions Workflow (`.github/workflows/dbt.yml`)

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

### Docker Compose (Recommended)

Run the full stack locally:

```bash
cd etl
docker-compose up
```

This starts:
- ML Red Team Service (port 8000)
- Webhook handler (port 3001)

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

### ML Service Deployment

**Docker:**
```bash
cd etl/ml-service
docker build -t ml-red-team .
docker run -p 8000:8000 --env-file .env ml-red-team
```

**Render:**
1. Create new Web Service
2. Connect to this repo
3. Set root directory to `etl/ml-service`
4. Build command: `pip install -r requirements.txt`
5. Start command: `python main.py`

**Environment Variables:**
- `DATABASE_URL` - Postgres connection
- `POLL_INTERVAL` - Seconds between polls (default: 2.0)
- `MODEL_VERSION` - Model version tag
- `ENABLE_FALLBACK` - Allow SQL trigger fallback

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
