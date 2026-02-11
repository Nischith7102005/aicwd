# monitr-ai - LLM Observability Platform

A static-first LLM observability platform with real-time dashboards, adversarial testing, and automated ETL pipelines for cognitive waste analysis.

## Features

- **Real-time Metrics**: Track token efficiency, latency, costs, and success rates
- **Adversarial Testing**: Probe models with uncensored local LLMs for bias and censorship detection
- **Cognitive Waste Index**: Proprietary metric combining semantic drift, efficiency, and quality indicators
- **Automated ETL**: dbt Core + Postgres pipeline with GitHub Actions scheduling

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.11+
- Convex account

### Setup

```bash
# Install dependencies
npm install

# Set up Convex
npx convex dev

# Start the frontend
npm run dev
```

## ETL Pipeline

The ETL pipeline exports telemetry data from Convex to Postgres for advanced analytics.

### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Convex    │────▶│   Webhook   │────▶│   Postgres  │────▶│   dbt       │
│  Database   │     │   Handler   │     │  Database   │     │  Models     │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### Configuration

1. **Deploy the webhook handler** (see [etl/README.md](etl/README.md)):
   ```bash
   cd etl
   npm install
   npm run webhook
   ```

2. **Configure Convex environment variables**:
   - `ETL_WEBHOOK_URL` - Your webhook endpoint
   - `ETL_WEBHOOK_SECRET` - Shared secret for authentication

3. **Run dbt manually**:
   ```bash
   cd etl
   pip install dbt-postgres
   dbt deps
   dbt run
   ```

### GitHub Actions

The dbt pipeline runs automatically:
- **Hourly** via scheduled cron job
- **On demand** via manual workflow dispatch
- **On webhook trigger** via repository dispatch

## Project Structure

```
├── convex/              # Backend Convex functions
│   ├── agent.ts         # Stress test actions
│   ├── etlExport.ts     # ETL export actions
│   ├── ingest.ts        # Inference logging
│   ├── metrics.ts       # Metrics computation
│   └── schema.ts        # Database schema
├── frontend/            # Static HTML/CSS/JS dashboard
├── etl/                 # dbt + Postgres ETL pipeline
│   ├── models/          # dbt models
│   ├── webhook.ts       # Webhook handler
│   └── README.md        # ETL documentation
└── .github/workflows/   # CI/CD workflows
```

## Environment Variables

### Convex
```bash
CONVEX_DEPLOY_KEY=       # Convex deployment key
ETL_WEBHOOK_URL=         # Webhook endpoint URL
ETL_WEBHOOK_SECRET=      # Webhook authentication secret
```

### ETL Webhook
```bash
PORT=3001                # Webhook server port
DATABASE_URL=            # Postgres connection string
WEBHOOK_SECRET=          # Shared secret
```

## License

MIT
