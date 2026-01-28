# AICWD Credentials Setup

This document outlines the credentials needed for the AICWD system. Replace the placeholder values with your actual credentials.

## Required Credentials

### 1. Convex Deployment Credentials

**Where to get:** https://dashboard.convex.dev

1. Create a new Convex project
2. Navigate to Project Settings
3. Copy your deployment URL and key

**Files to update:**
- `backend/.env.local`
- `frontend/index.html` (JavaScript configuration)

**Format:**
```env
CONVEX_DEPLOYMENT_URL=https://your-project-name.convex.cloud
CONVEX_DEPLOYMENT_KEY=dev:your-project-key
```

### 2. Groq API Key

**Where to get:** https://console.groq.com/keys

1. Sign up for a Groq account
2. Navigate to API Keys section
3. Create a new API key

**Files to update:**
- `backend/.env.local`

**Format:**
```env
GROQ_API_KEY=gsk_your-actual-api-key-here
```

### 3. Docker Model Endpoint

**Where to get:** Your cloud deployment platform (Render/Railway/Fly.io)

1. Deploy the Docker image to your preferred platform
2. Note the public HTTPS endpoint
3. Ensure the `/generate` endpoint is accessible

**Files to update:**
- `backend/.env.local`

**Format:**
```env
DOCKER_MODEL_ENDPOINT=https://your-docker-app-name.render.com
```

## Setup Instructions

### Step 1: Update Backend Configuration

Edit `backend/.env.local` with your actual credentials:

```bash
cd backend
nano .env.local  # or use your preferred editor
```

Replace these placeholder values:
- `your-convex-deployment.convex.cloud` → Your Convex deployment URL
- `dev:your-convex-key` → Your Convex deployment key
- `gsk_your-groq-api-key` → Your Groq API key
- `https://aicwd-model.render.com` → Your Docker model endpoint

### Step 2: Update Frontend Configuration

Edit `frontend/index.html`:

```javascript
// Around line 400, find:
const CONVEX_URL = 'https://tacit-wombat-870.convex.cloud';

// Replace with your Convex deployment URL:
const CONVEX_URL = 'https://your-project-name.convex.cloud';
```

### Step 3: Verify Configuration

Test that all credentials are correct:

```bash
# Test Convex connection
curl https://your-project-name.convex.cloud/api/health

# Test Groq API (requires your key)
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer gsk_your-actual-api-key-here"

# Test Docker model
curl -X POST https://your-docker-app-name.render.com/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello!"}'
```

## Security Notes

### Important:
- **Never commit actual credentials** to version control
- `.env.local` is included in `.gitignore` for this reason
- `.env.example` contains only placeholder values
- Rotate API keys regularly for production deployments

### For Development:
- Use development API keys with limited permissions
- Test credentials in a staging environment first
- Monitor API usage and costs

### For Production:
- Use production API keys
- Enable rate limiting and quotas
- Set up alerting for API failures
- Use secrets management (e.g., Vault, AWS Secrets Manager)
- Rotate credentials on a regular schedule

## Troubleshooting

### Convex Authentication Errors

**Error:** "Invalid deployment key"
**Solution:** Verify the key format matches `dev:project-key|hash`

### Groq API Errors

**Error:** "Invalid API key"
**Solution:** Check that the key starts with `gsk_` and has no extra spaces

### Docker Model Connection Errors

**Error:** "Connection refused"
**Solution:** 
1. Verify Docker container is running
2. Check that port 8000 is exposed
3. Ensure HTTPS endpoint is publicly accessible

## Credential Formats

### Convex Key Format
```
dev:project-name|base64-encoded-here
```

### Groq API Key Format
```
gsk_ followed by 32+ alphanumeric characters
```

### Docker Endpoint Format
```
https://app-name.platform.com
```

## Additional Resources

- **Convex Docs:** https://docs.convex.dev
- **Groq Docs:** https://console.groq.com/docs
- **Docker Deployment:**
  - Render: https://render.com/docs
  - Railway: https://docs.railway.app
  - Fly.io: https://fly.io/docs

## Support

If you encounter issues with credentials:
1. Verify each credential individually using the test commands above
2. Check the logs of each service for specific error messages
3. Ensure you're using the correct environment (dev/staging/prod)
4. Review the DEPLOYMENT.md for more detailed troubleshooting steps
