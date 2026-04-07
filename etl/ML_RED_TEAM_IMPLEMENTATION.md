# ML Red Team Implementation Summary

## Overview

This implementation replaces the PostgreSQL function-based Red Team algorithm with a trained ML model that transforms raw LLM logs into security metrics.

## Architecture Changes

### Before (SQL-Based)
```
Convex → Webhook → raw_llm_events → PostgreSQL Trigger → SQL Functions → security_metrics
```

### After (ML-Based)
```
Convex → Webhook → raw_llm_events → ML Service (XGBoost) → security_metrics
                                           ↓
                                    ┌──────────────┐
                                    │ 50+ Features │
                                    │ Attack Detect│
                                    │ Risk Scoring │
                                    └──────────────┘
```

## Files Created

### Core ML Service (`etl/ml-service/`)

| File | Purpose |
|------|---------|
| `main.py` | FastAPI application with REST endpoints |
| `model.py` | XGBoost multi-output regressor implementation |
| `features.py` | Feature extraction (50+ features) |
| `database.py` | PostgreSQL async operations |
| `processor.py` | Background event processing loop |
| `train.py` | Model training script |
| `config.py` | Configuration management |
| `test_model.py` | Unit tests |
| `requirements.txt` | Python dependencies |
| `Dockerfile` | Container definition |
| `.env.example` | Environment template |
| `README.md` | Service documentation |

### Infrastructure

| File | Purpose |
|------|---------|
| `etl/docker-compose.yml` | Full stack orchestration |
| `etl/webhook.Dockerfile` | Webhook container |

### Notebooks

| File | Purpose |
|------|---------|
| `ml-service/notebooks/exploration.ipynb` | Jupyter notebook for model exploration |

## Files Modified

| File | Changes |
|------|---------|
| `etl/red_team_schema.sql` | Added comment explaining ML service; disabled trigger by default |
| `etl/.env.example` | Added ML service configuration options |
| `etl/README.md` | Added ML service documentation |
| `.gitignore` | Added ML artifacts to ignore list |

## ML Model Architecture

### Feature Extraction (50+ features)

1. **Text Features**
   - Prompt/response lengths, word counts
   - Character ratios (uppercase, special chars, digits)
   - Structural features (newlines, bullets, code blocks)

2. **Attack Pattern Features**
   - 8 attack categories (instruction_override, jailbreak, etc.)
   - Binary match indicators
   - Pattern density scoring

3. **Leakage Detection**
   - API key patterns
   - Internal IP detection
   - Credential exposure
   - PII detection (SSN, email, phone)

4. **Hallucination Markers**
   - Hedging words (maybe, perhaps, possibly)
   - Certainty words (definitely, absolutely)
   - Unverifiable statements
   - Response length ratios

5. **Temporal Features**
   - Tokens per second
   - Token efficiency ratios
   - Latency analysis

6. **Metadata**
   - Provider/model encoding
   - Adversarial flag

### Model

- **Algorithm**: XGBoost multi-output regressor
- **Outputs**: 6 risk scores (0-1)
  - injection_risk (weight: 0.25)
  - leakage_risk (weight: 0.20)
  - hallucination_risk (weight: 0.15)
  - bias_risk (weight: 0.10)
  - anomaly_risk (weight: 0.15)
  - tool_misuse_risk (weight: 0.15)
- **CRI Calculation**: Weighted sum of risk scores
- **CRI Levels**: minimal (<0.15), low (<0.35), moderate (<0.55), high (<0.75), critical (>=0.75)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/predict` | POST | Predict risk for single event |
| `/predict/batch` | POST | Batch prediction |
| `/train` | POST | Trigger model training |
| `/stats` | GET | Processing statistics |
| `/features/importance` | GET | Model feature importance |
| `/config` | GET | Current configuration |
| `/process/once` | POST | Manual processing iteration |

## Deployment

### Docker Compose
```bash
cd etl
docker-compose up
```

### Manual
```bash
cd etl/ml-service
pip install -r requirements.txt
python train.py --synthetic
python main.py
```

## Training Modes

1. **Synthetic Training** (`--synthetic`)
   - Uses known attack patterns from `red_team_schema.sql`
   - Quick setup for initial deployment
   - No database required

2. **Database Training** (`--database`)
   - Uses existing `security_metrics` as labels
   - Requires at least 100 labeled samples
   - Better accuracy on production data

## Fallback Strategy

If ML service is unavailable:
1. Enable PostgreSQL trigger: `ALTER TABLE raw_llm_events ENABLE TRIGGER trg_red_team_analysis`
2. SQL functions process events (less accurate but reliable)
3. Re-enable ML service when ready

## Comparison: SQL vs ML

| Aspect | SQL Functions | ML Model |
|--------|--------------|----------|
| Accuracy | Fixed patterns | Learned patterns |
| Adaptability | Manual updates | Retrain on new data |
| Inference Time | <10ms | 20-50ms |
| Explainability | Exact pattern match | Feature importance |
| Maintenance | SQL updates | Model retraining |
| Complexity | Low | Medium |

## Monitoring

The service tracks:
- Events processed per second
- Average inference latency
- High-risk detection rate
- Model version
- Database connection status

## Configuration

Key environment variables:
- `DATABASE_URL` - Postgres connection
- `POLL_INTERVAL` - Seconds between polls (default: 2.0)
- `BATCH_SIZE` - Events per batch (default: 10)
- `MODEL_VERSION` - Model version tag
- `N_ESTIMATORS` - XGBoost trees (default: 100)
- `ENABLE_FALLBACK` - Allow SQL trigger fallback

## Testing

```bash
cd etl/ml-service
pytest test_model.py -v
```

## Future Improvements

- [ ] BERT embeddings for semantic understanding
- [ ] Online learning from user feedback
- [ ] A/B testing framework
- [ ] Model drift detection
- [ ] GPU acceleration for inference
- [ ] SHAP values for explainability
