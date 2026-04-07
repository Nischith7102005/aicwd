# ML Red Team Service

Machine Learning-based security analysis service that replaces the PostgreSQL function-based Red Team algorithm with a trained XGBoost model.

## Overview

This service transforms raw LLM logs into security metrics using ML instead of static SQL rules:

**Previous Flow:**
```
Convex → Webhook → raw_llm_events → PostgreSQL Trigger → SQL Functions → security_metrics
```

**New Flow:**
```
Convex → Webhook → raw_llm_events → ML Service (XGBoost) → security_metrics
```

## Architecture

- **FastAPI** application with REST endpoints
- **XGBoost** multi-output regressor for 6 risk scores
- **Feature Extractor** with 50+ engineered features
- **Async PostgreSQL** with connection pooling
- **Background polling** for new events

## Quick Start

### 1. Install Dependencies

```bash
cd etl/ml-service
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 3. Train Initial Model

```bash
# Train with synthetic data (for initial setup)
python train.py --synthetic

# Or train from existing labeled data
python train.py --database
```

### 4. Run Service

```bash
python main.py
```

The service will:
- Start on port 8000
- Poll for unprocessed events every 2 seconds
- Run ML inference on new events
- Write results to `security_metrics` table

## API Endpoints

### Health Check
```bash
GET /health
```

### Predict Single Event
```bash
POST /predict
Content-Type: application/json

{
  "prompt": "Your prompt here",
  "response": "LLM response",
  "provider": "openai",
  "model": "gpt-4",
  "input_tokens": 100,
  "output_tokens": 200,
  "latency_ms": 1500
}
```

### Batch Predict
```bash
POST /predict/batch
Content-Type: application/json

{
  "events": [
    { "prompt": "...", ... },
    { "prompt": "...", ... }
  ]
}
```

### Get Statistics
```bash
GET /stats
```

### Feature Importance
```bash
GET /features/importance
```

## Model Features

The model uses 50+ features across categories:

- **Text Features**: Length, ratios, character patterns
- **Attack Patterns**: 8 categories with binary and count features
- **Leakage Indicators**: API keys, credentials, PII detection
- **Hallucination Markers**: Hedging words, certainty markers
- **Temporal Features**: Tokens/sec, latency, efficiency ratios
- **Metadata**: Provider/model hashes, adversarial flag

## Risk Scores (Output)

| Risk | Weight | Description |
|------|--------|-------------|
| injection_risk | 0.25 | Prompt injection attacks |
| leakage_risk | 0.20 | Data exfiltration |
| hallucination_risk | 0.15 | Factual inconsistencies |
| bias_risk | 0.10 | Model bias indicators |
| anomaly_risk | 0.15 | Behavioral anomalies |
| tool_misuse_risk | 0.15 | Tool/function misuse |

**CRI** = weighted sum of risk scores (0-1)

## Docker Deployment

```bash
cd etl
docker-compose up ml-service
```

## Training

### Synthetic Training (Quick Start)
Uses known attack patterns from `red_team_schema.sql`:
```bash
python train.py --synthetic
```

### Database Training (Production)
Uses existing labeled security metrics:
```bash
python train.py --database
```

Requirements:
- At least 100 labeled samples
- Events with computed security metrics

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| DATABASE_URL | - | Postgres connection string |
| POLL_INTERVAL | 2.0 | Seconds between polls |
| BATCH_SIZE | 10 | Events per batch |
| N_ESTIMATORS | 100 | XGBoost trees |
| MAX_DEPTH | 10 | Tree depth |
| LEARNING_RATE | 0.1 | Learning rate |
| ENABLE_FALLBACK | true | Allow SQL fallback |

## Fallback Strategy

If ML service is unavailable:
1. Enable PostgreSQL trigger: `ALTER TABLE raw_llm_events ENABLE TRIGGER trg_red_team_analysis`
2. SQL functions process events (less accurate but reliable)
3. Re-enable ML service when ready

## Monitoring

The service exposes:
- `/health` - Service health
- `/stats` - Processing statistics
- Prometheus metrics on port 9090

Key metrics:
- Events processed per second
- Average inference latency
- High-risk detection rate
- Model version

## Model Versions

Models are saved to `artifacts/` directory:
- `model_v1.joblib` - Initial synthetic training
- `model_v2.joblib` - Database retraining

To load a specific version:
```python
model.load("artifacts/model_v2.joblib")
```

## Development

### Running Tests
```bash
pytest tests/
```

### Code Formatting
```bash
black *.py
flake8 *.py
```

## Comparison: SQL vs ML

| Aspect | SQL Functions | ML Model |
|--------|--------------|----------|
| Accuracy | Fixed patterns | Learned patterns |
| Adaptability | Manual updates | Retrain on new data |
| Inference Time | <10ms | 20-50ms |
| Explainability | Exact pattern match | Feature importance |
| Maintenance | SQL updates | Model retraining |
| Cost | Database CPU | Service hosting |

## Future Improvements

- [ ] BERT embeddings for semantic understanding
- [ ] Online learning from user feedback
- [ ] A/B testing framework
- [ ] Model drift detection
- [ ] GPU acceleration for inference
