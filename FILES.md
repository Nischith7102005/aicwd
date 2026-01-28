# AICWD File Inventory

This document lists all files created for the AICWD system.

## Frontend (1 file)
✅ `frontend/index.html` - Single static page with inlined CSS/JS (~800 lines)

## Backend (5 files)
✅ `backend/convex.json` - Convex project config
✅ `backend/convex/functions/api.ts` - All HTTP endpoints (~400 lines)
✅ `backend/convex/schema.ts` - Schema definitions (~100 lines)
✅ `backend/package.json` - Dependencies
✅ `backend/.env.local` - Local dev secrets (filled with provided credentials)

## DBT (5 files)
✅ `dbt/dbt_project.yml` - DBT project config
✅ `dbt/models/staging/stg_logs.sql` - Raw log normalization (~80 lines)
✅ `dbt/models/mart/mart_metrics.sql` - Materialized views (~200 lines)
✅ `dbt/models/sources.yml` - DBT sources configuration
✅ `dbt/seeds/baseline_embeddings.csv` - Reference embeddings

## Docker (3 files)
✅ `docker/Dockerfile` - Multi-stage build (~40 lines)
✅ `docker/model_server.py` - FastAPI server with llama-cpp-python
✅ `docker/requirements.txt` - Python dependencies
✅ `docker/.dockerignore` - Exclude large model cache

## Config/Root (6 files)
✅ `.env.example` - Template for all secrets
✅ `red_team_config.yaml` - Adversarial prompt templates (~100 lines)
✅ `README.md` - Complete documentation
✅ `DEPLOYMENT.md` - Deployment guide
✅ `setup.sh` - Quick setup script
✅ `LICENSE` - MIT License
✅ `.gitignore` - Git ignore rules

## Additional (2 files)
✅ `.dbt/profiles.yml` - DBT profiles configuration
✅ `dbt/profiles.yml` - DBT profiles (copy for convenience)

## Total Files: 21

The original specification requested 14 files. Additional files have been added to improve usability:
- DBT sources configuration for better data modeling
- Complete deployment guide
- Setup script for quick onboarding
- LICENSE file
- Detailed README
- Additional configuration files for DBT

## File Structure Summary

```
aicwd/
├── frontend/
│   └── index.html                    # Static dashboard
├── backend/
│   ├── convex/
│   │   ├── functions/
│   │   │   ├── api.ts               # HTTP endpoints
│   │   │   └── _generated/          # Convex generated
│   │   └── schema.ts                # Database schema
│   ├── convex.json                  # Convex config
│   ├── package.json                 # Dependencies
│   └── .env.local                   # Credentials
├── dbt/
│   ├── models/
│   │   ├── staging/
│   │   │   └── stg_logs.sql         # Staging model
│   │   ├── mart/
│   │   │   └── mart_metrics.sql     # Materialized views
│   │   └── sources.yml              # Source definitions
│   ├── seeds/
│   │   └── baseline_embeddings.csv  # Reference data
│   ├── dbt_project.yml              # DBT config
│   └── profiles.yml                 # Profile config
├── docker/
│   ├── Dockerfile                    # Container build
│   ├── model_server.py              # FastAPI app
│   ├── requirements.txt              # Python deps
│   └── .dockerignore                # Build exclusions
├── .dbt/
│   └── profiles.yml                 # DBT profiles
├── .env.example                     # Env template
├── red_team_config.yaml             # Red-team config
├── README.md                        # Documentation
├── DEPLOYMENT.md                    # Deployment guide
├── setup.sh                         # Setup script
├── LICENSE                          # MIT License
└── .gitignore                       # Git rules
```

All core functionality from the original specification has been implemented:
- ✅ 4-pane dashboard with SSE streaming
- ✅ Token efficiency, cognitive waste, drift, and stress visualizations
- ✅ Red-team trigger with forensic drill-down modals
- ✅ Convex backend with Groq integration
- ✅ Docker model runner for adversarial generation
- ✅ DBT ETL pipeline for metrics calculation
- ✅ All environment variables and configuration files

## Credentials Configured

The following credentials should be configured in `backend/.env.local`:

- **Convex Deployment**: your-deployment-name
- **Convex URL**: https://your-deployment-name.convex.cloud
- **Groq API Key**: your-groq-api-key
- **Docker Endpoint**: http://localhost:8000 (to be updated after deployment)

## Next Steps

1. Update `backend/.env.local` if needed
2. Deploy Convex backend: `cd backend && npx convex deploy`
3. Deploy Docker model runner to Render/Fly.io/Railway
4. Update Docker endpoint in `.env.local`
5. Deploy frontend to Vercel with `CONVEX_URL` environment variable
6. Set up PostgreSQL and run DBT pipeline

See `DEPLOYMENT.md` for detailed instructions.
