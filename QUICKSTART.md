# AICWD Quick Start Guide

Get the Cognitive Waste Observatory running in 5 minutes.

## Prerequisites Check

- [ ] Node.js 18+ installed
- [ ] Python 3.11+ installed
- [ ] Docker installed
- [ ] Git installed

## Installation Steps

### 1. Clone and Setup

```bash
# Clone the repository
git clone <your-repo-url>
cd aicwd

# Verify file structure
ls -la
# You should see: frontend/, backend/, dbt/, docker/
```

### 2. Backend Setup (Convex)

```bash
# Navigate to backend
cd backend

# Install dependencies
npm install

# Start Convex development server
npx convex dev

# Follow the prompts to authenticate with Convex
# The server will start at http://localhost:3210
```

**Keep this terminal running** - this is your backend server.

### 3. Frontend Setup (Local Testing)

For local testing without deploying to Vercel yet:

```bash
# Open a new terminal
cd aicwd

# Start a simple HTTP server
cd frontend
python3 -m http.server 8000
```

Now open your browser: `http://localhost:8000`

### 4. Docker Model Setup (Local)

```bash
# Open a new terminal
cd aicwd/docker

# Build the Docker image
docker build -t aicwd-model .

# Run the container
docker run -p 8000:8000 aicwd-model
```

**Test the Docker model:**
```bash
curl -X POST http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, world!"}'
```

### 5. DBT Setup (Optional, for ETL)

```bash
# Install DBT
pip install dbt-postgres

# Create PostgreSQL database
createdb aicwd_db

# Configure profiles
mkdir -p ~/.dbt
# Edit ~/.dbt/profiles.yml with your PostgreSQL credentials

# Run DBT
cd aicwd/dbt
dbt seed
dbt run
```

## Quick Testing

### Test Backend Ingest

```bash
curl -X POST http://localhost:3210/api/metrics/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is AI?",
    "response": "AI stands for Artificial Intelligence...",
    "model": "llama-3.3-70b-versatile",
    "prompt_tokens": 5,
    "response_tokens": 30,
    "total_tokens": 35,
    "latency_ms": 500
  }'
```

### Test Red-Team

```bash
curl -X POST http://localhost:3210/api/red-team/start
```

### Test DBT Trigger

```bash
curl -X POST http://localhost:3210/api/dbt/schedule
```

## Frontend Features

Once you have `http://localhost:8000` open:

1. **Check Connection Status** - Top status bar should show "Connected"
2. **View Dashboard** - 4 panels showing real-time metrics
3. **Start Stress Test** - Click "Initiate Stress Test" button
4. **Run DBT** - Click "Run DBT Transformations" button
5. **Export Data** - Click "Export Data" to download JSON

### Interactive Features

- **Heatmap Click** - Click any cell to see forensic analysis
- **Alert Monitor** - Watch for red/yellow alerts on waste spikes
- **Real-time Updates** - Dashboard refreshes every 5 seconds via SSE

## Production Deployment

When ready for production:

### Deploy Frontend (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from frontend directory
cd frontend
vercel --prod
```

### Deploy Docker (Render/Railway/Fly.io)

```bash
# Example with Railway
npm i -g @railway/cli
railway login
cd docker
railway up
```

### Deploy Backend (Convex)

```bash
cd backend
npx convex deploy
```

Update environment variables in:
- Vercel project settings: `CONVEX_URL`
- Backend `.env.local`: `DOCKER_MODEL_ENDPOINT`

## Environment Variables

Copy `.env.example` to `.env.local` and update:

```bash
cp .env.example backend/.env.local
```

Edit `backend/.env.local`:
```env
CONVEX_DEPLOYMENT_URL=https://your-convex-deployment.convex.cloud
CONVEX_DEPLOYMENT_KEY=dev:your-convex-key
GROQ_API_KEY=gsk_your-groq-api-key
DOCKER_MODEL_ENDPOINT=https://your-docker-url.com
```

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 8000
lsof -i :8000
# Kill the process
kill -9 <PID>
```

### Convex Authentication Issues

```bash
# Logout and re-login
npx convex logout
npx convex login
```

### Docker Build Fails

```bash
# Clear Docker cache
docker system prune -a

# Rebuild
docker build --no-cache -t aicwd-model .
```

### SSE Not Connecting

1. Check Convex server is running
2. Check browser console for errors
3. Verify CORS settings (should allow all origins for dev)

## Next Steps

- Read `DEPLOYMENT.md` for production deployment
- Read `PROJECT_STRUCTURE.md` for architecture details
- Review `README.md` for project overview
- Customize `red_team_config.yaml` for your needs

## Key Metrics to Monitor

### Token Efficiency
- **Good:** > 0.7
- **Warning:** < 0.4
- **Critical:** < 0.2

### Cognitive Waste
- **Good:** < 1.5
- **Warning:** > 1.5
- **Critical:** > 2.5 (triggers audio alert)

### Semantic Drift
- **Good:** < 0.3
- **Warning:** > 0.4
- **Critical:** > 0.7

### Adversarial Stress
- **Good:** < 2.0s
- **Warning:** > 3.0s
- **Critical:** > 5.0s

## Support

For detailed documentation:
- `DEPLOYMENT.md` - Full deployment guide
- `PROJECT_STRUCTURE.md` - Architecture details
- `README.md` - Project overview

For issues:
- Check Convex logs: `npx convex logs --follow`
- Check Docker logs: `docker logs <container-id>`
- Check browser console for frontend errors
