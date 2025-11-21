# Setup Guide

This guide walks you through setting up the DEX Order Execution Engine from scratch.

## Prerequisites

### Required Software

1. **Node.js** (>= 18.0.0)
   ```bash
   node --version  # Should be >= 18.0.0
   ```

2. **MongoDB** (>= 5.0)
   ```bash
   mongod --version
   ```

3. **Redis** (>= 6.0)
   ```bash
   redis-server --version
   ```

4. **Git**
   ```bash
   git --version
   ```

### Installation (macOS/Linux)

```bash
# Install Node.js (using nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# Install MongoDB
# macOS
brew tap mongodb/brew
brew install mongodb-community@5.0

# Ubuntu
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Install Redis
# macOS
brew install redis

# Ubuntu
sudo apt-get install redis-server
```

## Project Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd eterna_project
```

### 2. Install Dependencies

```bash
npm install
```

This will install:
- **Runtime**: fastify, mongoose, ioredis, bullmq
- **WebSocket**: @fastify/websocket
- **Dev Dependencies**: typescript, jest, ts-jest, @types/node, etc.

### 3. Environment Configuration

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/dex-order-engine

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Queue Configuration
QUEUE_CONCURRENCY=10
QUEUE_RATE_LIMIT=100

# Logging
LOG_LEVEL=info
```

### 4. Start Services

#### MongoDB

```bash
# macOS (as service)
brew services start mongodb-community@5.0

# Linux (as service)
sudo systemctl start mongod

# Manual start
mongod --dbpath /path/to/data
```

Verify MongoDB is running:
```bash
mongosh
# Should connect successfully
```

#### Redis

```bash
# macOS (as service)
brew services start redis

# Linux (as service)
sudo systemctl start redis

# Manual start
redis-server
```

Verify Redis is running:
```bash
redis-cli ping
# Should return: PONG
```

### 5. Initialize Database

Run the database setup script to create indexes:

```bash
npm run setup-db
```

This will:
- Connect to MongoDB
- Create indexes on Order collection:
  - `type`, `pair`, `status`, `createdAt`, `txHash`
  - Compound indexes for common queries
- Display confirmation message

Expected output:
```
Database setup completed successfully!
Indexes created:
- type
- pair
- status
- createdAt
- txHash
- Compound: status + createdAt
- Compound: pair + status
```

### 6. Build TypeScript

```bash
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

### 7. Start Development Server

```bash
npm run dev
```

Expected output:
```
MongoDB connected successfully
Redis connected successfully
Worker started with concurrency: 10
Queue ready for processing
Server listening on http://localhost:3000
```

## Verification

### 1. Health Check

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-20T10:30:00.000Z",
  "uptime": 5,
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

### 2. Execute Test Order

```bash
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "MARKET",
    "pair": "BTC/USDT",
    "amount": 0.5,
    "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }'
```

Expected response:
```json
{
  "orderId": "65abc123def456789",
  "status": "PENDING",
  "message": "Order received and queued for processing",
  "websocket": "/api/orders/65abc123def456789/ws"
}
```

### 3. Check Order Status

```bash
curl http://localhost:3000/api/orders/65abc123def456789
```

Wait 3-5 seconds and the order should be CONFIRMED.

### 4. WebSocket Test

Using `wscat`:

```bash
npm install -g wscat
wscat -c ws://localhost:3000/api/orders/65abc123def456789/ws
```

You should see:
```json
{"type":"connected","clientId":"client-abc123","subscribedTo":"65abc123def456789"}
```

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- OrderService.test.ts

# Run in watch mode
npm test -- --watch
```

Expected output:
```
 PASS  tests/unit/services/OrderService.test.ts
 PASS  tests/unit/controllers/OrderController.test.ts
 PASS  tests/integration/api.test.ts
 ...

Test Suites: 12 passed, 12 total
Tests:       69 passed, 69 total
Snapshots:   0 total
Time:        8.5s
```

## Common Setup Issues

### MongoDB Connection Failed

**Error**: `MongoServerError: connect ECONNREFUSED`

**Solutions**:
1. Check MongoDB is running:
   ```bash
   brew services list | grep mongodb
   # or
   sudo systemctl status mongod
   ```

2. Verify connection string in `.env`:
   ```env
   MONGODB_URI=mongodb://localhost:27017/dex-order-engine
   ```

3. Check MongoDB logs:
   ```bash
   # macOS
   tail -f /usr/local/var/log/mongodb/mongo.log

   # Linux
   sudo journalctl -u mongod -f
   ```

### Redis Connection Failed

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:6379`

**Solutions**:
1. Check Redis is running:
   ```bash
   redis-cli ping
   # Should return: PONG
   ```

2. Start Redis:
   ```bash
   brew services start redis
   # or
   sudo systemctl start redis
   ```

3. Check Redis configuration:
   ```bash
   redis-cli config get bind
   # Should include 127.0.0.1
   ```

### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3000`

**Solutions**:
1. Find process using port 3000:
   ```bash
   lsof -i :3000
   ```

2. Kill the process:
   ```bash
   kill -9 <PID>
   ```

3. Or use a different port in `.env`:
   ```env
   PORT=3001
   ```

### TypeScript Build Errors

**Error**: `Cannot find module` or type errors

**Solutions**:
1. Clean and reinstall:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. Rebuild:
   ```bash
   npm run build
   ```

3. Check TypeScript version:
   ```bash
   npx tsc --version
   # Should be >= 5.0.0
   ```

### Worker Not Processing Orders

**Issue**: Orders stuck in PENDING status

**Solutions**:
1. Check worker logs for errors
2. Verify Redis connection
3. Check queue metrics in `/health` endpoint
4. Restart worker:
   ```bash
   # Stop server
   # Start again
   npm run dev
   ```

## Development Workflow

### 1. Make Changes

Edit TypeScript files in `src/`

### 2. Auto-Reload

With `npm run dev`, changes auto-reload using `tsx watch`

### 3. Run Tests

```bash
npm test
```

### 4. Build for Production

```bash
npm run build
npm start
```

## Next Steps

1. **Import Postman Collection**: See [postman/README.md](../postman/README.md)
2. **Run Test Scripts**: See Phase 7 documentation
3. **Deploy to Railway**: See [DEPLOYMENT.md](DEPLOYMENT.md)
4. **Review API Documentation**: See [API.md](API.md)

## Additional Resources

- [MongoDB Documentation](https://docs.mongodb.com/)
- [Redis Documentation](https://redis.io/documentation)
- [Fastify Documentation](https://fastify.dev/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
