# Railway Deployment Guide

Complete guide for deploying the DEX Order Execution Engine to Railway.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Railway Project Setup](#railway-project-setup)
3. [Environment Configuration](#environment-configuration)
4. [Deployment Steps](#deployment-steps)
5. [Post-Deployment Testing](#post-deployment-testing)
6. [Troubleshooting](#troubleshooting)
7. [Monitoring & Logs](#monitoring--logs)

---

## Prerequisites

### Required Accounts

1. **GitHub Account** - For repository hosting
2. **Railway Account** - Sign up at [railway.app](https://railway.app)
   - Sign in with GitHub for easy integration

### Local Setup

Ensure your project is ready for deployment:

```bash
# Test build locally
npm run build

# Verify build output
ls -la dist/

# Test production start
npm start
```

All tests should pass:
```bash
npm test
```

---

## Railway Project Setup

### 1. Create New Project

1. Go to [railway.app](https://railway.app)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Authorize Railway to access your GitHub account
5. Select your repository: `eterna_project`

### 2. Add MongoDB Service

Railway provides managed MongoDB:

1. In your project, click **"+ New"**
2. Select **"Database"** → **"Add MongoDB"**
3. Railway will provision a MongoDB instance
4. Note: Connection string will be automatically available as `MONGODB_URL`

**MongoDB Configuration:**
- Version: MongoDB 5.x or 6.x
- Storage: Starts with 1GB (auto-scales)
- Region: Select closest to your users

### 3. Add Redis Service

1. Click **"+ New"**
2. Select **"Database"** → **"Add Redis"**
3. Railway will provision a Redis instance
4. Connection details automatically available as environment variables

**Redis Configuration:**
- Version: Redis 7.x
- Memory: Starts with 512MB
- Persistence: Enabled by default

### 4. Configure Application Service

Railway auto-detects Node.js:

1. Click on your application service
2. Go to **"Settings"**
3. Verify build configuration:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`

---

## Environment Configuration

### Railway Environment Variables

Railway automatically provides some variables. You need to add custom ones:

#### 1. Navigate to Variables

1. Click on your application service
2. Go to **"Variables"** tab
3. Click **"+ New Variable"**

#### 2. Add Required Variables

```env
# Server Configuration
NODE_ENV=production
PORT=$PORT
# Railway automatically provides $PORT, no need to set manually

# MongoDB (Railway provides MONGODB_URL automatically)
MONGODB_URI=${{MongoDB.MONGODB_URL}}

# Redis (Railway provides these automatically)
REDIS_HOST=${{Redis.REDIS_HOST}}
REDIS_PORT=${{Redis.REDIS_PORT}}
REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}

# Queue Configuration
QUEUE_CONCURRENCY=10
QUEUE_RATE_LIMIT=100

# Logging
LOG_LEVEL=info

# Order Processing
MAX_CONCURRENT_ORDERS=10
ORDERS_PER_MINUTE=100
MAX_RETRY_ATTEMPTS=3

# Trading Configuration
DEFAULT_SLIPPAGE=0.01
PRICE_VARIATION_MIN=0.02
PRICE_VARIATION_MAX=0.05
MOCK_MODE=true
```

#### 3. Reference Service Variables

Railway allows referencing other services:

- MongoDB: `${{MongoDB.MONGODB_URL}}`
- Redis Host: `${{Redis.REDIS_HOST}}`
- Redis Port: `${{Redis.REDIS_PORT}}`
- Redis Password: `${{Redis.REDIS_PASSWORD}}`

**Important:** Railway automatically injects these when services are linked.

#### 4. Verify Variables

After adding variables, click **"Deploy"** to apply changes.

---

## Deployment Steps

### Step 1: Push to GitHub

```bash
# Initialize git (if not already done)
cd eterna_project
git init

# Add all files
git add .

# Commit
git commit -m "feat: initial deployment setup for Railway

- Add Railway configuration files (railway.json, Procfile)
- Configure production environment variables
- Update package.json with engines and description
- Add deployment documentation"

# Create GitHub repository and push
git remote add origin https://github.com/YOUR_USERNAME/eterna_project.git
git branch -M main
git push -u origin main
```

### Step 2: Connect Railway to GitHub

1. In Railway project, click **"Settings"**
2. Under **"Source"**, click **"Connect GitHub repo"**
3. Select your repository
4. Railway will automatically deploy on push

### Step 3: Monitor Deployment

1. Go to **"Deployments"** tab
2. Watch build logs in real-time
3. Look for:
   ```
   ✓ Installing dependencies
   ✓ Building TypeScript
   ✓ Starting application
   ✓ Health check passed
   ```

### Step 4: Get Public URL

1. Go to **"Settings"** → **"Networking"**
2. Click **"Generate Domain"**
3. Railway provides a public URL: `your-app.railway.app`

**Custom Domain (Optional):**
1. Click **"Custom Domain"**
2. Add your domain (e.g., `api.yourdomain.com`)
3. Configure DNS records as shown

### Step 5: Initialize Database

After successful deployment, initialize database indexes:

**Option A: Via Railway CLI**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Run setup script
railway run npm run setup:db
```

**Option B: Via API Call**

The database will auto-initialize on first order, but you can manually trigger:

```bash
# Create a test order to initialize
curl -X POST https://your-app.railway.app/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "MARKET",
    "pair": "BTC/USDT",
    "amount": 0.1,
    "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }'
```

---

## Post-Deployment Testing

### 1. Health Check

```bash
curl https://your-app.railway.app/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-20T10:30:00.000Z",
  "uptime": 120,
  "database": "connected",
  "redis": "connected",
  "queue": {
    "waiting": 0,
    "active": 0,
    "completed": 0,
    "failed": 0,
    "delayed": 0,
    "total": 0
  }
}
```

### 2. Test Order Execution

```bash
export BASE_URL=https://your-app.railway.app
export WS_URL=your-app.railway.app

npm run test:single
```

### 3. Test All Endpoints

```bash
# Execute order
curl -X POST https://your-app.railway.app/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "MARKET",
    "pair": "BTC/USDT",
    "amount": 0.5,
    "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }'

# Get order (replace ORDER_ID)
curl https://your-app.railway.app/api/orders/ORDER_ID

# List orders
curl https://your-app.railway.app/api/orders
```

### 4. WebSocket Test

```bash
# Install wscat globally
npm install -g wscat

# Connect to WebSocket (replace ORDER_ID)
wscat -c wss://your-app.railway.app/api/orders/ORDER_ID/ws
```

### 5. Run Full Test Suite

Update environment variables and run tests:

```bash
# Set production URL
export BASE_URL=https://your-app.railway.app
export WS_URL=your-app.railway.app

# Run tests
npm run test:all-pairs
npm run test:concurrent 5
```

---

## Troubleshooting

### Deployment Fails

#### Build Error: "Cannot find module"

**Cause:** Missing dependencies

**Solution:**
```bash
# Ensure all dependencies are in package.json
npm install
git add package.json package-lock.json
git commit -m "fix: update dependencies"
git push
```

#### Build Error: "TypeScript compilation failed"

**Cause:** Type errors in code

**Solution:**
```bash
# Fix locally first
npm run build

# If successful, push
git add .
git commit -m "fix: resolve TypeScript errors"
git push
```

#### Start Error: "Port already in use"

**Cause:** Not using Railway's `$PORT` variable

**Solution:**
Verify in `src/server.ts`:
```typescript
const PORT = process.env.PORT || 3000;
```

### Runtime Errors

#### "MongoDB connection failed"

**Check:**
1. MongoDB service is running in Railway
2. `MONGODB_URI` variable is set: `${{MongoDB.MONGODB_URL}}`
3. MongoDB service is in same project

**Fix:**
1. Go to Railway → MongoDB service → Settings
2. Ensure it's running (green status)
3. Re-link environment variable

#### "Redis connection refused"

**Check:**
1. Redis service is running
2. Environment variables are set:
   - `REDIS_HOST=${{Redis.REDIS_HOST}}`
   - `REDIS_PORT=${{Redis.REDIS_PORT}}`
   - `REDIS_PASSWORD=${{Redis.REDIS_PASSWORD}}`

**Fix:**
1. Restart Redis service
2. Re-deploy application

#### "Health check failed"

**Cause:** Application not starting correctly

**Check logs:**
1. Railway → Deployments → View Logs
2. Look for errors in startup

**Common causes:**
- Missing environment variables
- Database connection issues
- Port binding issues

### Performance Issues

#### Slow Response Times

**Check:**
1. Railway metrics (CPU, Memory usage)
2. MongoDB query performance
3. Redis connection latency

**Solutions:**
- Upgrade Railway plan for more resources
- Optimize database queries
- Add database indexes (already configured)

#### WebSocket Disconnections

**Check:**
1. Railway WebSocket support is enabled
2. Client reconnection logic
3. Network stability

**Solutions:**
- Implement WebSocket reconnection in client
- Use WebSocket ping/pong for keep-alive

---

## Monitoring & Logs

### Railway Metrics

1. Go to your application service
2. Click **"Metrics"** tab
3. Monitor:
   - CPU usage
   - Memory usage
   - Network traffic
   - Request count

### View Logs

```bash
# Via Railway dashboard
Railway → Service → Logs (real-time)

# Via Railway CLI
railway logs
railway logs --follow
```

### Log Levels

Application uses Pino logger with levels:

- `fatal`: Critical errors
- `error`: Error messages
- `warn`: Warnings
- `info`: Informational (default in production)
- `debug`: Debug messages
- `trace`: Detailed trace

Change log level via environment variable:
```env
LOG_LEVEL=debug
```

### Key Metrics to Monitor

1. **Health Endpoint**: `/health`
   - Database status
   - Redis status
   - Queue metrics

2. **Queue Metrics**:
   - Waiting: Orders in queue
   - Active: Currently processing
   - Completed: Successfully processed
   - Failed: Failed orders

3. **Error Rate**:
   - Monitor failed order percentage
   - Should be < 5% (considering mock 95-97% success rates)

4. **Response Times**:
   - Order submission: < 100ms
   - Order processing: 3-5s
   - WebSocket latency: < 50ms

### Alerts (Optional)

Railway supports webhooks for alerts:

1. Go to **"Settings"** → **"Webhooks"**
2. Add webhook URL (e.g., Slack, Discord)
3. Configure triggers:
   - Deployment failed
   - Service crashed
   - Resource limits exceeded

---

## Scaling

### Horizontal Scaling

Railway supports horizontal scaling:

1. Go to **"Settings"** → **"Scaling"**
2. Increase replicas (instances)
3. Railway load balances automatically

**Note:** Ensure your application is stateless (it is, using Redis for queue state).

### Vertical Scaling

Upgrade Railway plan for more resources:

- **Hobby**: 512MB RAM, 0.5 vCPU
- **Pro**: 8GB RAM, 8 vCPU
- **Enterprise**: Custom

### Database Scaling

MongoDB and Redis auto-scale on Railway:

- Storage increases automatically
- Memory can be upgraded via plan

---

## Cost Optimization

### Free Tier Limits

Railway free tier includes:
- $5 free credit/month
- 512MB RAM
- 1GB storage

**Estimated usage:**
- Application: ~$5-10/month
- MongoDB: ~$2-5/month
- Redis: ~$1-3/month

**Total:** ~$8-18/month (after free credits)

### Optimization Tips

1. **Use sleep mode**: Auto-sleep after inactivity (free tier)
2. **Optimize images**: Use smaller Docker images (if using Docker)
3. **Database indexes**: Already configured for query optimization
4. **Connection pooling**: Already implemented in Mongoose and Redis

---

## Continuous Deployment

### Auto-Deploy on Push

Railway automatically deploys when you push to GitHub:

```bash
git add .
git commit -m "feat: add new feature"
git push
```

Railway will:
1. Detect push
2. Build application
3. Run health check
4. Deploy if successful
5. Rollback if failed

### Manual Deployment

1. Railway dashboard → **"Deployments"**
2. Click **"Redeploy"**
3. Select previous deployment to rollback

### Deployment Branches

Configure which branch triggers deployment:

1. **"Settings"** → **"Source"**
2. Set branch: `main` or `production`
3. Create staging environment with `staging` branch

---

## Security Best Practices

### Environment Variables

✅ **Do:**
- Use Railway's environment variables
- Never commit `.env` to git
- Use different credentials for production

❌ **Don't:**
- Hardcode credentials
- Share production credentials
- Use development credentials in production

### API Security (Future Enhancement)

Consider adding:
- API key authentication
- Rate limiting per user
- CORS configuration
- Request size limits

### Database Security

Railway MongoDB is:
- Password protected
- Network isolated
- Encrypted at rest
- Backed up automatically

---

## Backup & Recovery

### Database Backups

Railway provides automatic backups:

1. Go to MongoDB service → **"Backups"**
2. View automatic backup schedule
3. Manually create backup if needed

**Restore from backup:**
1. Select backup from list
2. Click **"Restore"**
3. Confirm restoration

### Manual Backup

```bash
# Using Railway CLI
railway run mongodump --uri=$MONGODB_URI --out=./backup

# Download backup locally
railway run tar -czf backup.tar.gz backup/
```

---

## Next Steps

After successful deployment:

1. ✅ Test all endpoints
2. ✅ Run test scripts against production
3. ✅ Monitor logs for errors
4. ✅ Record demo video (see [VIDEO_GUIDE.md](VIDEO_GUIDE.md))
5. ✅ Update Postman collection with production URL
6. ✅ Share public URL with stakeholders

---

## Support

### Railway Support

- Documentation: [docs.railway.app](https://docs.railway.app)
- Discord: [discord.gg/railway](https://discord.gg/railway)
- Status: [status.railway.app](https://status.railway.app)

### Application Issues

- Check logs first: Railway → Service → Logs
- Review health endpoint: `/health`
- Test locally: `npm run dev`
- Check GitHub issues: Repository issues page
