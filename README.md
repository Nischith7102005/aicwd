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

## Connect Flow (`index → auth → key → dashboard`)

The API-key step is runnable in **demo mode** — see `DEMO_MODE` in
`frontend/key.html`:

- anything typed into the key field is accepted; if the format matches no known
  provider, a provider and model are filled in automatically and the flow always
  lands on `dashboard.html`;
- the configuration is written to `localStorage.target_config` and the flow
  continues locally; no remote configuration service is contacted, so a
  placeholder key can never block the flow;
- the provider and model controls are optional; pressing **Connect & Launch** always navigates to the local dashboard.

### GA4 events

`frontend/analytics.js` wraps gtag (measurement ID `G-FK3PF0KZ2R`) for the funnel:

| Event | Fired when | Parameters |
| --- | --- | --- |
| `key_entry_started` | first character typed into the key field | `page` |
| `key_provider_resolved` | provider detected (or accepted) | `provider`, `auto_detected`, `key_length_bucket` |
| `key_submitted` | connect is pressed | `provider`, `model`, `provider_mode`, `demo_mode` |
| `key_accepted` / `key_rejected` | configuration saved, or failed | `result`, `reason` |
| `generate_lead` | successful connect (usable as a GA4 conversion) | `method`, `provider` |
| `dashboard_opened` | dashboard loaded from a submitted key | `provider`, `model`, `demo_mode` |
| `key_change_requested` | "CHANGE KEY" clicked | `source` |

API keys are **never** sent to Google Analytics, raw or masked. The helper
allowlists the parameter names above and drops secret-looking values, so only
metadata (provider, model, key-length bucket) reaches GA4. The connect flow is
local-only and does not send the key to a remote configuration backend.

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
