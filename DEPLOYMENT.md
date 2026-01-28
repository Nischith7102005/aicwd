# Deployment Guide

This guide walks through deploying the AICWD system to production.

## Prerequisites

- Node.js 18+
- Python 3.11+
- Docker and Docker Compose
- Vercel CLI (`npm install -g vercel`)
- Fly.io CLI or Render account (for Docker deployment)
- Convex CLI (`npm install -g convex-dev`)

## Step 1: Deploy Backend (Convex)

```bash
cd backend
npm install
```

Set up environment variables in `backend/.env.local`:

```env
CONVEX_DEPLOYMENT=your-deployment-name
CONVEX_DEPLOYMENT_KEY=dev:deployment-name|your-deployment-key
GROQ_API_KEY=your-groq-api-key
DOCKER_MODEL_ENDPOINT=http://localhost:8000
```

Deploy to Convex:

```bash
npx convex deploy
```

Note down your Convex URL (e.g., `https://tacit-wombat-870.convex.cloud`)

## Step 2: Deploy Docker Model Runner

### Option A: Fly.io

```bash
cd docker
fly launch
fly deploy
```

Get your app URL (e.g., `https://aicwd-model.fly.dev`)

### Option B: Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set root directory to `docker`
4. Deploy

Get your service URL (e.g., `https://aicwd-model.onrender.com`)

### Option C: Railway

```bash
railway login
railway init
railway up
```

Update `backend/.env.local` with the Docker endpoint:
```env
DOCKER_MODEL_ENDPOINT=https://your-docker-app-url.com
```

## Step 3: Deploy Frontend (Vercel)

```bash
cd frontend
vercel
```

When prompted:
- Project name: `aicwd-dashboard`
- Directory: `.` (current directory)
- Override settings? No

Add environment variable in Vercel dashboard:
- Key: `CONVEX_URL`
- Value: `https://tacit-wombat-870.convex.cloud` (your Convex URL)

Deploy again to apply changes:
```bash
vercel --prod
```

## Step 4: Initialize DBT

### Option A: Local PostgreSQL

Set up PostgreSQL:
```bash
# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Create database
sudo -u postgres psql
CREATE DATABASE aicwd;
CREATE USER dbt_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE aicwd TO dbt_user;
\q
```

Update `.dbt/profiles.yml`:
```yaml
aicwd:
  outputs:
    dev:
      type: postgres
      host: localhost
      user: dbt_user
      password: secure_password
      port: 5432
      dbname: aicwd
      schema: dbt_aicwd
      threads: 4
  target: dev
```

Run DBT:
```bash
cd dbt
dbt debug
dbt seed
dbt run
```

### Option B: Cloud PostgreSQL (Neon, Supabase, etc.)

1. Create a PostgreSQL instance on Neon or Supabase
2. Get connection string
3. Update `.dbt/profiles.yml` with cloud credentials
4. Run `dbt debug` and `dbt run`

## Step 5: Verify Deployment

### Test Frontend
1. Open Vercel deployment URL
2. Check browser console for SSE connection
3. Verify dashboard loads

### Test Backend
```bash
curl https://your-convex-url/api/metrics/stream
```

### Test Docker Model
```bash
curl https://your-docker-url/health
```

### Test Red-Team
1. Click "Initiate Stress Test" in dashboard
2. Monitor progress bar
3. Check results appear in forensic modal

## Step 6: Optional - Automated DBT via Convex

To run DBT automatically from Convex, you would need to:

1. Set up a PostgreSQL instance accessible from Convex
2. Create a scheduled function in `backend/convex/functions/api.ts` that:
   - Exports Convex data to PostgreSQL
   - Executes DBT CLI via child_process (requires custom runtime)
   - Imports results back to Convex

For simplicity, the current implementation uses demo metrics when DBT is not configured.

## Environment Variables Reference

### Convex
```env
CONVEX_DEPLOYMENT=your-deployment-name
CONVEX_DEPLOYMENT_KEY=dev:deployment-name|your-key
```

### Groq
```env
GROQ_API_KEY=gsk_your-api-key
```

### Docker Model
```env
DOCKER_MODEL_ENDPOINT=https://your-docker-app.com
```

### Vercel
```
CONVEX_URL=https://your-convex-url.convex.cloud
```

## Monitoring

### Check Convex Logs
```bash
npx convex logs
```

### Check Docker Logs
```bash
# Fly.io
fly logs

# Render
# Check Render dashboard

# Railway
railway logs
```

### Check Vercel Logs
```bash
vercel logs
```

## Troubleshooting

### SSE Connection Fails
- Verify CONVEX_URL is correct
- Check Convex functions are deployed: `npx convex dashboard`
- Check browser console for CORS errors

### Red-Team Test Fails
- Verify Docker endpoint is accessible
- Check Groq API key has credits
- Check Convex logs for errors

### Dashboard Shows No Data
- Run DBT to generate metrics: `dbt seed && dbt run`
- Check Convex database has data: `npx convex dashboard`
- Trigger manual metrics generation via `/api/dbt/schedule`

## Scaling

### Convex Scaling
Convex automatically scales based on demand. Monitor usage in the Convex dashboard.

### Vercel Scaling
Vercel Pro plan includes:
- Unlimited bandwidth
- Faster builds
- Team collaboration

### Docker Scaling
Configure scaling in your deployment platform:
- Fly.io: `fly scale count 3`
- Render: Add more containers in settings
- Railway: Add more instances

## Security Considerations

1. **Environment Variables**: Never commit `.env.local` files
2. **API Keys**: Rotate keys regularly
3. **CORS**: Update allowed origins in production
4. **Rate Limiting**: Implement rate limiting on public endpoints
5. **Authentication**: Add auth for production use

## Cost Estimation

- Convex: Free tier includes 500K reads, 100K writes/month
- Groq: $0.59 per 1M input tokens, $0.79 per 1M output tokens
- Docker (Fly.io): ~$5-15/month depending on region and CPU
- Vercel: Free tier for hobby projects, Pro $20/month
- PostgreSQL: Free tier on Neon/Supabase sufficient for most use cases

## Support

For issues:
1. Check logs in respective platforms
2. Review this guide
3. Open an issue on GitHub

## Next Steps

1. Set up monitoring alerts (UptimeRobot, Pingdom)
2. Configure automated backups
3. Set up CI/CD for deployments
4. Add analytics (Google Analytics, Plausible)
5. Implement authentication for dashboard access
