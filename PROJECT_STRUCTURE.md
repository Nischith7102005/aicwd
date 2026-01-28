# AICWD Project Structure

Complete file structure for the Cognitive Waste Observatory system.

## Directory Overview

```
aicwd/
├── frontend/                    # Static frontend for Vercel
│   └── index.html              # Single-page dashboard (~800 lines)
│
├── backend/                     # Convex serverless backend
│   ├── convex/
│   │   ├── _generated/         # Auto-generated Convex files
│   │   │   ├── api.ts
│   │   │   ├── dataModel.ts
│   │   │   └── server.ts
│   │   ├── functions/
│   │   │   └── api.ts          # All API endpoints (~400 lines)
│   │   └── schema.ts           # Database schema definitions
│   ├── convex.json             # Convex project config
│   ├── package.json            # Dependencies
│   └── .env.local              # Local secrets
│
├── dbt/                         # DBT ETL pipeline
│   ├── models/
│   │   ├── staging/
│   │   │   └── stg_logs.sql    # Log normalization (~80 lines)
│   │   └── mart/
│   │       └── mart_metrics.sql # Materialized views (~200 lines)
│   ├── seeds/
│   │   └── baseline_embeddings.csv # Reference embeddings
│   └── dbt_project.yml          # DBT configuration
│
├── docker/                      # Uncensored model runner
│   ├── Dockerfile               # Multi-stage build (~40 lines)
│   ├── .dockerignore
│   ├── app.py                   # FastAPI application
│   ├── model_downloader.py      # Model download script
│   └── requirements.txt        # Python dependencies
│
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore rules
├── red_team_config.yaml         # Adversarial prompt templates
├── README.md                    # Project documentation
└── DEPLOYMENT.md                # Deployment guide
```

## File Descriptions

### Root Configuration Files

#### `.env.example`
Template for all environment variables:
- Convex deployment URL and key
- Groq API key
- Docker model endpoint
- DBT configuration
- Adversarial model settings
- Cognitive waste thresholds

#### `red_team_config.yaml`
Adversarial prompt templates for red-teaming:
- Jailbreak attempts
- Logic puzzles
- Semantic overload queries
- Contradictory constraints
- Cognitive load stressors
- Hallucination triggers
- Context injection attacks

#### `.gitignore`
Excludes sensitive files and build artifacts:
- Environment files
- Node modules
- DBT targets
- Docker model cache
- IDE files

### Frontend (1 file)

#### `frontend/index.html`
Single static HTML page with:
- **4-pane dashboard layout:**
  - Token Efficiency scatter plot
  - Cognitive Waste gauge
  - Drift timeline
  - Adversarial stress indicator
- **SSE connection** to `/api/metrics/stream`
- **Red-team trigger button** → POST `/api/red-team/start`
- **Web Audio alert** on waste spikes
- **Forensic drill-down modal** for detailed analysis
- **Interactive heatmap** for time-range selection
- All CSS and JavaScript inlined (~800 lines)

### Backend (6 files)

#### `backend/convex.json`
Convex project configuration defining:
- Function mappings
- HTTP routes
- File paths

#### `backend/convex/schema.ts`
Database schema with 6 tables:
- `logs` - Raw LLM interactions
- `metrics` - Computed metrics
- `redTeamRuns` - Red-team execution records
- `adversarialResults` - Adversarial prompt results
- `baselineEmbeddings` - Reference embeddings
- `dbtRuns` - DBT execution records

#### `backend/convex/functions/api.ts`
All API endpoints consolidated:
- `POST /api/metrics/ingest` - Log ingestion
- `GET /api/metrics/stream` - SSE streaming
- `POST /api/red-team/start` - Trigger red-team test
- `GET /api/red-team/status` - Poll red-team progress
- `GET /api/red-team/results` - Fetch adversarial findings
- `POST /api/dbt/schedule` - Manual DBT trigger
- Helper functions for:
  - Groq API calls
  - Cognitive waste calculation
  - Coherence scoring
  - Hallucination probability
  - Adversarial prompt generation

#### `backend/package.json`
Dependencies:
- `convex` (^1.15.0)
- `groq-sdk` (^0.7.0)
- TypeScript dev dependencies

#### `backend/.env.local`
Local development secrets (filled in with provided credentials)

### DBT (4 files)

#### `dbt/dbt_project.yml`
DBT project configuration:
- Model paths
- Materialization strategies
- Profile configuration

#### `dbt/models/staging/stg_logs.sql`
Staging model for log normalization:
- Raw log structuring
- Derived metrics
- Session classification
- Timestamp parsing (~80 lines)

#### `dbt/models/mart/mart_metrics.sql`
Materialized views with 4 metrics:
1. **Token Efficiency** - Tokens per semantic unit
2. **Semantic Drift** - Embedding deviation from baseline
3. **Adversarial Stress** - Latency/coherence under attack
4. **Fragility Score** - Delta baseline vs. adversarial (~200 lines)

#### `dbt/seeds/baseline_embeddings.csv`
Reference embeddings for drift calculation:
- 10 baseline categories
- Embedding vectors
- Timestamps

### Docker (5 files)

#### `docker/Dockerfile`
Multi-stage build for uncensored model:
- Python 3.11 runtime
- llama-cpp-python installation
- FastAPI application
- Health checks
- Port 8000 exposure (~40 lines)

#### `docker/.dockerignore`
Excludes:
- Model cache (downloaded at runtime)
- Python cache
- IDE files
- Documentation

#### `docker/app.py`
FastAPI application with endpoints:
- `/` - Root endpoint
- `/health` - Health check
- `/generate` - Text generation
- `/models` - List available models
- `/red-team/generate` - Adversarial prompt generation

#### `docker/model_downloader.py`
Script to download GGUF model from HuggingFace

#### `docker/requirements.txt`
Python dependencies:
- fastapi
- uvicorn
- pydantic
- llama-cpp-python
- huggingface-hub

## Key Flows

### 1. Real-Time Monitoring Flow
```
Frontend (index.html)
    ↓ SSE
Convex /api/metrics/stream
    ↓ Query
Convex Database (logs, metrics)
    ↓ Update
Dashboard (4-pane UI)
```

### 2. Red-Team Stress Test Flow
```
Frontend (Trigger Button)
    ↓ POST
Convex /api/red-team/start
    ↓ Generate
Docker Model (Uncensored)
    ↓ Send
Groq API (Primary LLM)
    ↓ Log
Convex Database
    ↓ Transform
DBT Mart Views
    ↓ Push via SSE
Dashboard (Resilience Curve)
```

### 3. DBT ETL Flow
```
Convex Database (Raw Logs)
    ↓ Export (CSV)
DBT Staging (stg_logs)
    ↓ Transform
DBT Mart (mart_metrics)
    ↓ Load
Convex Database (Computed Metrics)
```

### 4. Forensic Analysis Flow
```
Frontend (Heatmap Click)
    ↓ Filter by Time
Convex /api/metrics/stream
    ↓ Query Specific Logs
Modal Display:
  - Metrics (Token Efficiency, Waste, Drift)
  - Prompt & Response
  - Wasteful Sections Analysis
  - Baseline Comparison
```

## API Endpoints

### Convex Backend
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/metrics/ingest` | Ingest LLM interaction logs |
| GET | `/api/metrics/stream` | SSE stream for real-time metrics |
| POST | `/api/red-team/start` | Trigger adversarial stress test |
| GET | `/api/red-team/status` | Poll red-team execution status |
| GET | `/api/red-team/results` | Fetch adversarial test results |
| POST | `/api/dbt/schedule` | Manual DBT transformation trigger |

### Docker Model
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Root endpoint with API info |
| GET | `/health` | Health check |
| POST | `/generate` | Generate text from uncensored model |
| GET | `/models` | List available models |
| POST | `/red-team/generate` | Generate adversarial prompts |

## Environment Variables

### Required for All Deployments
```bash
CONVEX_DEPLOYMENT_URL=https://tacit-wombat-870.convex.cloud
CONVEX_DEPLOYMENT_KEY=dev:tacit-wombat-870|...
GROQ_API_KEY=gsk_...
DOCKER_MODEL_ENDPOINT=https://your-docker-url.com
```

### Optional Thresholds
```bash
COGNITIVE_WASTE_ALERT_THRESHOLD=2.5
TOKEN_EFFICIENCY_THRESHOLD=0.7
SEMANTIC_DRIFT_THRESHOLD=0.8
FRAGILITY_SCORE_THRESHOLD=0.6
```

### Configuration
```bash
DBT_SCHEDULE_INTERVAL_MINUTES=15
SSE_UPDATE_INTERVAL_MS=5000
ADVERSARIAL_PROMPT_COUNT=50
```

## Deployment Targets

| Component | Platform | Command |
|-----------|----------|---------|
| Frontend | Vercel | `vercel deploy frontend` |
| Backend | Convex | `npx convex deploy` |
| Docker | Render/Railway/Fly.io | `railway up` / `fly launch` |
| DBT | Local/Scheduled | `dbt seed && dbt run` |

## Credential Summary

Credentials should be obtained from:
- **Convex:** https://dashboard.convex.dev
- **Groq:** https://console.groq.com/keys
- **Docker Model:** DavidAU/OpenAi-GPT-oss-20b-abliterated-uncensored-NEO-Imatrix-gguf:Q5_1 (from HuggingFace)

## File Count Summary

- **Root Config:** 3 files (.env.example, red_team_config.yaml, .gitignore)
- **Frontend:** 1 file (index.html)
- **Backend:** 7 files (convex.json, schema.ts, api.ts, package.json, .env.local, plus 3 generated)
- **DBT:** 4 files (dbt_project.yml, stg_logs.sql, mart_metrics.sql, baseline_embeddings.csv)
- **Docker:** 5 files (Dockerfile, .dockerignore, app.py, model_downloader.py, requirements.txt)
- **Documentation:** 3 files (README.md, DEPLOYMENT.md, PROJECT_STRUCTURE.md)

**Total: 23 files** (includes auto-generated and documentation files)

All core files (excluding generated and docs): **14 files** ✅
