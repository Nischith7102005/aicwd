# AICWD Deployment Guide

This guide provides step-by-step instructions for deploying the Cognitive Waste Observatory to production.

## Prerequisites

- Node.js 18+ installed
- Python 3.11+ installed
- Docker installed
- Vercel account
- Convex account (already configured)
- Render/Railway/Fly.io account for Docker deployment
- Groq API key (provided)
- DBT installed (`pip install dbt-postgres`)

## 1. Frontend Deployment (Vercel)

### Option A: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy frontend
cd frontend
vercel --prod
```

### Option B: Vercel Dashboard
1. Go to [vercel.com](https://vercel.com)
2. Create a new project
3. Import the `frontend` directory
4. Set environment variable:
   - `CONVEX_URL=https://tacit-wombat-870.convex.cloud`
5. Deploy

**Frontend URL:** Will be provided by Vercel after deployment

## 2. Docker Model Deployment (Render/Railway/Fly.io)

### Option A: Render
```bash
# Install Render CLI
npm i -g @render/cli

# Login to Render
render login

# Deploy
cd docker
render deploy --env var DOCKER_MODEL_ENDPOINT=https://your-app-name.onrender.com
```

### Option B: Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
cd docker
railway up
```

### Option C: Fly.io
```bash
# Install Fly.io CLI
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Launch app
cd docker
flyctl launch

# Get the public URL
flyctl info
```

**Note:** The Docker service exposes port 8000 with the `/generate` endpoint.

**Docker Endpoint URL:** Replace `https://aicwd-model.render.com` in `.env` with your deployed endpoint.

## 3. Convex Backend Deployment

### Development Mode
```bash
cd backend

# Install dependencies
npm install

# Start development server
npx convex dev
```

### Production Deployment
```bash
# Deploy to Convex
cd backend
npx convex deploy
```

**Convex URL:** `https://tacit-wombat-870.convex.cloud` (already configured)

## 4. DBT Setup

### Install DBT
```bash
# Install DBT with PostgreSQL adapter
pip install dbt-postgres

# Verify installation
dbt --version
```

### Configure Profiles
Create or edit `~/.dbt/profiles.yml`:
```yaml
aicwd:
  target: dev
  outputs:
    dev:
      type: postgres
      host: localhost
      port: 5432
      user: your_db_user
      pass: your_db_password
      dbname: aicwd_db
      schema: aicwd
      threads: 4
```

### Run DBT Transformations
```bash
cd dbt

# Seed baseline data
dbt seed

# Run transformations
dbt run

# Generate documentation (optional)
dbt docs generate
dbt docs serve
```

## 5. Environment Configuration

### Update `.env.local` in Backend
```bash
cd backend

# Edit .env.local with your actual values:
# - CONVEX_DEPLOYMENT_URL (already set)
# - CONVEX_DEPLOYMENT_KEY (already set)
# - GROQ_API_KEY (already set)
# - DOCKER_MODEL_ENDPOINT (update with your deployed URL)
```

### Update Vercel Environment Variables
1. Go to your Vercel project settings
2. Add environment variable:
   - `CONVEX_URL=https://tacit-wombat-870.convex.cloud`

## 6. Testing the Deployment

### Test Convex Backend
```bash
curl -X POST https://tacit-wombat-870.convex.cloud/api/metrics/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is the meaning of life?",
    "response": "The meaning of life is a philosophical question...",
    "model": "llama-3.3-70b-versatile",
    "prompt_tokens": 10,
    "response_tokens": 50,
    "total_tokens": 60,
    "latency_ms": 1500
  }'
```

### Test SSE Stream
Open browser DevTools → Network tab and visit your frontend URL. You should see an `EventSource` connection to `/api/metrics/stream`.

### Test Red-Team Endpoint
```bash
curl -X POST https://tacit-wombat-870.convex.cloud/api/red-team/start
```

### Test DBT Trigger
```bash
curl -X POST https://tacit-wombat-870.convex.cloud/api/dbt/schedule
```

### Test Docker Model
```bash
curl -X POST https://your-docker-url.com/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Generate a test response"}'
```

## 7. Verification Checklist

- [ ] Frontend loads at Vercel URL
- [ ] SSE connection established (check Network tab)
- [ ] Dashboard displays real-time metrics
- [ ] Red-team button initiates stress test
- [ ] DBT transformations run successfully
- [ ] Docker model responds to `/generate` endpoint
- [ ] Alerts trigger on cognitive waste spikes
- [ ] Forensic modal displays on heatmap click
- [ ] Data export works correctly

## 8. Monitoring

### Check Convex Logs
```bash
npx convex logs --follow
```

### Check Docker Logs
```bash
# Render
render logs

# Railway
railway logs

# Fly.io
flyctl logs
```

### Monitor Dashboard
- Token Efficiency: Should be > 0.7 (good), < 0.4 (warning)
- Cognitive Waste: Should be < 1.5 (good), > 2.5 (critical)
- Semantic Drift: Should be < 0.3 (good), > 0.7 (critical)
- Adversarial Stress: Should be < 2.0s (good), > 5.0s (warning)

## 9. Troubleshooting

### SSE Connection Issues
- Check Convex deployment URL is correct
- Verify network connectivity
- Check browser console for errors

### Red-Team Test Fails
- Verify Groq API key is valid
- Check Docker model endpoint is accessible
- Review Convex logs for errors

### DBT Run Fails
- Verify PostgreSQL connection
- Check DBT profile configuration
- Ensure `stg_logs.sql` has valid SQL syntax

### Docker Model Issues
- Check model file size (ensure sufficient storage)
- Verify `llama-cpp-python` installation
- Review Docker logs for startup errors

## 10. Scheduled Operations

### DBT Automatic Runs
The Convex backend includes a scheduled function that runs DBT every 15 minutes. This is handled automatically in production.

### Manual Triggers
You can manually trigger DBT runs via the dashboard "Run DBT Transformations" button or via API:
```bash
curl -X POST https://tacit-wombat-870.convex.cloud/api/dbt/schedule
```

## Production URLs

Update these with your actual deployed URLs:

- **Frontend:** [Your Vercel URL]
- **Convex Backend:** https://tacit-wombat-870.convex.cloud
- **Docker Model:** [Your Render/Railway/Fly.io URL]

## Support

For issues or questions:
- Check Convex documentation: https://docs.convex.dev
- Check DBT documentation: https://docs.getdbt.com
- Review the README.md for architecture details
