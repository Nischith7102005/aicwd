# AICWD - Cognitive Waste Monitoring System

A production-ready LLM observability platform with real-time SSE dashboards, adversarial validation, and DBT ETL pipelines.

## Architecture Overview

- **Frontend**: Static HTML (inlined CSS/JS) on Vercel with 4-pane dashboard
- **Backend**: Convex serverless functions with Groq LLM integration
- **LLM APIs**: Groq (primary inference), Docker-hosted uncensored model (adversarial generation)
- **Database**: Convex built-in DB for all telemetry
- **DBT**: Materialized SQL models for cognitive waste metrics
- **Deployment**: Frontend → Vercel, Docker → Render/Railway/Fly.io, Convex → managed

## Features

### Real-Time Dashboard
- **Token Efficiency Scatter**: Visualizes tokens per semantic unit
- **Cognitive Waste Gauge**: Live waste score with color-coded alerts
- **Semantic Drift Timeline**: Tracks embedding deviation from baseline
- **Adversarial Stress Indicator**: Heatmap showing resilience under attack

### Red-Team System
- Automated adversarial prompt generation using uncensored models
- Jailbreak detection and classification
- Waste score calculation with forensic drill-down
- Progress tracking and results export

### Educational ETL
- DBT pipelines transforming raw logs into metrics
- Materialized views for cognitive waste, drift, and fragility scores
- Baseline comparison and anomaly detection

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd aicwd
```

### 2. Backend Setup

```bash
cd backend
npm install
npx convex dev
```

Set environment variables in `backend/.env.local`:
```env
CONVEX_DEPLOYMENT=your-deployment-name
CONVEX_DEPLOYMENT_KEY=dev:deployment-name|your-deployment-key
GROQ_API_KEY=your-groq-api-key
DOCKER_MODEL_ENDPOINT=http://localhost:8000
```

### 3. Docker Model Runner

```bash
cd docker
docker build -t aicwd-model .
docker run -p 8000:8000 aicwd-model
```

Or deploy to Render/Railway:
```bash
fly launch
```

### 4. DBT Setup

```bash
cd dbt
pip install dbt-postgres
dbt seed
dbt run
```

### 5. Frontend Deployment

```bash
cd frontend
vercel deploy
```

Set environment variable:
```
CONVEX_URL=https://tacit-wombat-870.convex.cloud
```

## API Endpoints

### Metrics
- `POST /api/metrics/ingest` - Ingest LLM interaction logs
- `GET /api/metrics/stream` - SSE stream for live metrics

### Red-Team
- `POST /api/red-team/start` - Initiate stress test
- `GET /api/red-team/status` - Poll test progress
- `GET /api/red-team/results` - Fetch adversarial findings

### DBT
- `POST /api/dbt/schedule` - Trigger ETL pipeline

## File Structure

```
aicwd/
├── frontend/
│   └── index.html              # Single-file static dashboard
├── backend/
│   ├── convex/
│   │   ├── functions/
│   │   │   └── api.ts         # All HTTP endpoints
│   │   └── schema.ts          # Convex schema
│   ├── convex.json             # Convex config
│   └── package.json            # Dependencies
├── dbt/
│   ├── models/
│   │   ├── staging/
│   │   │   └── stg_logs.sql    # Raw log normalization
│   │   └── mart/
│   │       └── mart_metrics.sql # Materialized views
│   ├── seeds/
│   │   └── baseline_embeddings.csv
│   └── dbt_project.yml
├── docker/
│   ├── Dockerfile              # Multi-stage build
│   ├── model_server.py         # FastAPI server
│   └── requirements.txt
├── .env.example
└── red_team_config.yaml        # Adversarial templates
```

## Metrics Explained

### Token Efficiency
Calculates tokens per semantic unit:
```
efficiency = total_tokens / word_count
```

### Cognitive Waste
Combines verbosity, repetition, and tangential content:
```
waste = 1 + repetition_penalty + verbosity_penalty + noise
```

### Semantic Drift
Measures embedding deviation from baseline:
```
drift = |current_embedding - baseline_embedding| / baseline
```

### Adversarial Stress
Tracks performance under attack:
```
stress = latency_degradation + error_rate + response_degradation
```

## Deployment Checklist

- [ ] Convex deployed and functions working
- [ ] Groq API key configured
- [ ] Docker model runner deployed to cloud
- [ ] DBT pipeline seeded and running
- [ ] Frontend deployed to Vercel with correct CONVEX_URL
- [ ] SSE connection verified in browser DevTools
- [ ] Red-team test completed successfully

## Environment Variables

See `.env.example` for all required variables:

| Variable | Description | Required |
|----------|-------------|----------|
| CONVEX_DEPLOYMENT | Convex deployment name | Yes |
| CONVEX_DEPLOYMENT_KEY | Convex auth key | Yes |
| GROQ_API_KEY | Groq API key | Yes |
| DOCKER_MODEL_ENDPOINT | Docker model URL | Yes |
| DBT_PROJECT_PATH | Path to DBT project | No |

## Troubleshooting

### SSE Connection Issues
- Verify CONVEX_URL is correct
- Check browser console for errors
- Ensure Convex functions are deployed

### Red-Team Not Running
- Check Docker endpoint is accessible
- Verify Groq API key is valid
- Check Convex function logs

### DBT Pipeline Fails
- Verify PostgreSQL connection
- Check profiles.yml configuration
- Run `dbt debug` to diagnose issues

## Contributing

This project demonstrates:
1. Static-first architecture for low-cost hosting
2. Adversarial validation using uncensored models
3. DBT ETL for AI telemetry transformation
4. Real-time SSE dashboards without frameworks

## License

MIT License - see LICENSE file for details
