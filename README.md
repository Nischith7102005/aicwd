# AICWD - Cognitive Waste Index Platform

A complete, production-ready LLM observability system for monitoring cognitive waste, semantic drift, and adversarial resilience.

## Features

- **Static-First Dashboard**: 4-pane responsive layout with real-time Chart.js visualizations.
- **Real-Time Streaming**: SSE connection for live metric updates every 5s.
- **Adversarial Red-Teaming**: Automated stress tests using uncensored local models via Docker.
- **Cognitive Waste Index**: Proprietary metric computing token efficiency and semantic coherence using DBT.
- **Forensic Drill-Down**: Detailed analysis of LLM interactions, including perplexity and drift scores.

## Project Structure

- `frontend/`: Static HTML/JS dashboard.
- `backend/`: Convex functions for persistence, API, and orchestration.
- `dbt/`: Data transformations for metric computation.
- `docker/`: Uncensored model runner service.
- `red_team_config.yaml`: Adversarial campaign configuration.

## Setup & Deployment

### 1. Prerequisites
- Node.js & NPM
- Convex Account
- Groq API Key
- Docker

### 2. Backend (Convex)
```bash
cd backend
npm install
# Set your environment variables in .env.local
npx convex dev
```

### 3. Docker (Model Runner)
```bash
cd docker
docker build -t aicwd-model .
docker run -p 8000:8000 aicwd-model
```

### 4. DBT (Data Warehouse)
```bash
cd dbt
dbt seed
dbt run
```

### 5. Frontend
Open `frontend/index.html` in any browser. Ensure `VITE_CONVEX_URL` matches your Convex deployment.

## Metrics Calculation

1. **Token Efficiency**: `tokens / (semantic_payload_size)`
2. **Semantic Drift**: `cosine_similarity(response_embedding, baseline_embedding)`
3. **Adversarial Stress**: `response_latency_under_attack / baseline_latency`
4. **Fragility Score**: `(adversarial_waste - baseline_waste) / baseline_waste`
