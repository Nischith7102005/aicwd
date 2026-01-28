# AICWD System Architecture

## Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vercel Frontend                         │
│                    (Static HTML/CSS/JS)                         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Token        │  │ Cognitive    │  │ Semantic     │         │
│  │ Efficiency   │  │ Waste Gauge  │  │ Drift        │         │
│  │ Scatter      │  │              │  │ Timeline     │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                 │
│         └──────────────────┼──────────────────┘                 │
│                            │                                    │
│                    ┌───────▼────────┐                           │
│                    │   Dashboard    │                           │
│                    │   Controller   │                           │
│                    └───────┬────────┘                           │
└────────────────────────────┼────────────────────────────────────┘
                             │
                             │ SSE (EventSource)
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                     Convex Backend                              │
│                  (Serverless Functions)                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    HTTP Router                          │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                         │   │
│  │  GET  /api/metrics/stream   → SSE endpoint             │   │
│  │  POST /api/metrics/ingest   → Log ingestion             │   │
│  │  POST /api/red-team/start   → Trigger stress test       │   │
│  │  GET  /api/red-team/status  → Poll progress             │   │
│  │  GET  /api/red-team/results → Get findings             │   │
│  │  POST /api/dbt/schedule    → Trigger ETL               │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            │                                  │
│                            ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Convex Database                         │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  • logs (raw LLM interactions)                          │   │
│  │  • metrics (computed from DBT)                         │   │
│  │  • redTeamRuns (test execution state)                   │   │
│  │  • redTeamFindings (adversarial results)               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 Scheduled Jobs                           │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  • Every 15 min: Export → DBT → Import                 │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ REST API
                             │
                    ┌────────▼─────────┐
                    │     Groq API      │
                    │  (Llama 3.3 70B) │
                    └──────────────────┘

┌────────────────────────────┬────────────────────────────────────┐
│      Docker Model Runner   │          DBT Pipeline             │
│   (Render/Railway/Fly.io)  │    (PostgreSQL + dbt-core)       │
│                            │                                    │
│  ┌──────────────────────┐  │  ┌──────────────────────────┐    │
│  │   FastAPI Server     │  │  │   Staging Layer         │    │
│  │   Port: 8000         │  │  │   • stg_logs.sql        │    │
│  └──────────┬───────────┘  │  └───────────┬──────────────┘    │
│             │              │              │                   │
│  ┌──────────▼───────────┐  │  ┌───────────▼──────────────┐    │
│  │  llama-cpp-python    │  │  │   Mart Layer             │    │
│  │  • GGUF Model        │  │  │   • token_efficiency     │    │
│  │  • Uncensored        │  │  │   • cognitive_waste      │    │
│  │  • Q5_1 Quantization │  │  │   • semantic_drift       │    │
│  └──────────────────────┘  │  │   • adversarial_stress   │    │
│                            │  │   • fragility_score       │    │
│  ┌──────────────────────┐  │  └──────────────────────────┘    │
│  │   Model Endpoint     │  │                                   │
│  │   POST /generate     │  │  ┌──────────────────────────┐    │
│  │   GET  /health       │  │  │   Seeds                  │    │
│  └──────────────────────┘  │  │   • baseline_embeddings   │    │
│                            │  └──────────────────────────┘    │
└────────────────────────────┴───────────────────────────────────┘
```

## Data Flow

### 1. Normal Operation (Metrics Streaming)

```
Frontend (Browser)
    ↓ SSE request
Convex: GET /api/metrics/stream
    ↓ Stream events every 5s
Convex Database (metrics table)
    ↓ Pre-computed metrics
Frontend: Update charts/gauges
```

### 2. Log Ingestion

```
Application/System
    ↓ POST logs
Convex: POST /api/metrics/ingest
    ↓ Store raw log
Convex Database (logs table)
    ↓ Every 15 min (scheduled)
Export to PostgreSQL
    ↓ Run DBT
DBT Pipeline: Transform & Aggregate
    ↓ Import results
Convex Database (metrics table)
```

### 3. Red-Team Stress Test

```
Frontend: Click "Initiate Stress Test"
    ↓ POST request
Convex: POST /api/red-team/start
    ↓ Create run record
Convex Database (redTeamRuns table)
    ↓ Async execution
Convex: Execute red-team action
    ↓ Generate adversarial prompts
Docker Model: POST /generate
    ↓ Return adversarial prompts
Convex: Call Groq API for each prompt
Groq API: Llama 3.3 70B responses
    ↓ Calculate metrics
Convex: Store findings
    ↓ Update progress
Frontend: Poll GET /api/red-team/status
    ↓ Receive progress updates
Convex Database (metrics table)
    ↓ SSE stream
Frontend: Update dashboard with stress metrics
```

### 4. DBT ETL Pipeline

```
Convex Database (logs table)
    ↓ Export to CSV (scheduled job)
PostgreSQL: Import CSV
    ↓ Run DBT transforms
dbt run
    ↓ Staging models
stg_logs.sql (normalize raw logs)
    ↓ Mart models
mart_metrics.sql (calculate metrics)
    ↓ Materialized views
PostgreSQL (dbt_aicwd schema)
    ↓ Import results
Convex Database (metrics table)
```

## Technology Stack

### Frontend
- **HTML5/CSS3/JavaScript**: No build step required
- **Chart.js**: Data visualization
- **Server-Sent Events (SSE)**: Real-time updates
- **Deployment**: Vercel (static hosting)

### Backend
- **Convex**: Serverless functions and database
- **Groq SDK**: LLM API integration
- **TypeScript**: Type-safe code
- **Deployment**: Convex Cloud (managed)

### Docker Model Runner
- **FastAPI**: Python web framework
- **llama-cpp-python**: GGUF model inference
- **Docker**: Containerization
- **Deployment**: Render/Railway/Fly.io

### DBT Pipeline
- **dbt-core**: Data transformation framework
- **PostgreSQL**: Data warehouse
- **SQL**: Materialized views and models

## Security Considerations

1. **API Keys**: Stored in environment variables, never committed
2. **CORS**: Configured in FastAPI for Docker endpoint
3. **Rate Limiting**: Should be implemented for production
4. **Authentication**: Add auth for dashboard access
5. **HTTPS**: All connections use HTTPS in production

## Scaling Strategy

### Convex
- Automatic scaling based on request volume
- Free tier: 500K reads, 100K writes/month
- Pro tier: Higher limits and dedicated resources

### Vercel
- Edge deployment globally
- Automatic scaling with CDN
- Free tier sufficient for most use cases

### Docker Model Runner
- Horizontal scaling: Add more instances
- Load balancer: Distribute requests
- Fly.io: `fly scale count 3`

### PostgreSQL
- Connection pooling: PgBouncer
- Read replicas: For analytics queries
- Cloud hosting: Neon/Supabase (auto-scaling)

## Monitoring & Observability

### Metrics to Monitor
- Token efficiency trends
- Cognitive waste spikes
- Semantic drift over time
- Adversarial stress levels
- Red-team test results
- System latency and throughput

### Alerts
- Cognitive waste > 2.5 tokens
- Semantic drift > 0.3
- Adversarial stress > 0.7
- API error rate > 5%
- Response time > 5s

### Logging
- Convex function logs
- Docker container logs
- Vercel deployment logs
- DBT run results

## Cost Estimation (Monthly)

| Service | Free Tier | Pro Tier |
|---------|-----------|----------|
| Convex | $0 (500K reads) | $25 (10M reads) |
| Vercel | $0 (100GB bandwidth) | $20 (unlimited) |
| Groq API | $0 (free credits) | $0.59/1M tokens |
| Docker (Fly.io) | $0 (trial) | $5-15/month |
| PostgreSQL (Neon) | $0 (500MB) | $19 (8GB) |
| **Total** | **$0** | **~$50-70/month** |

## Deployment Pipeline

```
Git Push
    ↓
GitHub Actions (CI)
    ↓
Test: Unit tests, linting
    ↓
Deploy: Convex functions
    ↓
Deploy: Docker image
    ↓
Deploy: Vercel frontend
    ↓
Smoke tests
    ↓
Production ready ✓
```

## Development Workflow

1. **Local Development**
   - `npx convex dev` for backend
   - `docker run -p 8000:8000` for model runner
   - Open `frontend/index.html` directly

2. **Testing**
   - Test SSE connection in browser
   - Verify DBT transforms
   - Run red-team stress test

3. **Deployment**
   - Follow DEPLOYMENT.md guide
   - Update environment variables
   - Run smoke tests

## Next Steps for Production

1. **Add Authentication**: Protect dashboard with auth
2. **Rate Limiting**: Prevent abuse of public APIs
3. **Monitoring**: Set up UptimeRobot, PagerDuty
4. **Backups**: Configure automated backups
5. **CI/CD**: Set up GitHub Actions
6. **Documentation**: API docs, user guides
7. **Analytics**: Track usage with Google Analytics
