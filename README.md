# DEX Order Execution Engine

A high-performance, production-ready order execution engine for decentralized exchanges (DEX) with real-time WebSocket updates, intelligent routing, and concurrent order processing.

## 🔗 Quick Links

- **🚀 Quick Start:** [../QUICKSTART.md](../QUICKSTART.md) - Run and test the backend in 5 minutes
- **Live Demo:** [https://your-app.railway.app](https://your-app.railway.app) _(Update after deployment)_
- **Video Demo:** [YouTube Demo](https://youtube.com/watch?v=YOUR_VIDEO_ID) _(Update after recording)_
- **API Documentation:** [../API.md](../API.md)
- **Postman Collection:** [postman/DEX_Order_Engine.postman_collection.json](postman/DEX_Order_Engine.postman_collection.json)
- **Deployment Guide:** [../DEPLOYMENT.md](../DEPLOYMENT.md)

## Features

- **Multi-DEX Routing**: Intelligent routing across Raydium and Meteora DEXs
- **Real-time Updates**: WebSocket streaming of order status changes
- **Concurrent Processing**: Handle 10 simultaneous orders with 100/min rate limiting
- **Multiple Trading Pairs**: BTC/USDT, ETH/USDT, BTC/ETH, and 22 more pairs
- **Robust Error Handling**: Custom error classes with graceful degradation
- **Queue Management**: BullMQ with Redis for reliable job processing
- **Comprehensive Testing**: 59+ tests with Jest
- **Professional Documentation**: Complete API docs, setup guides, and test scripts
- **Dual Mode Operation**: Mock mode for testing and Real Devnet mode for Solana blockchain integration
- **Production Monitoring**: Comprehensive health checks and performance metrics
- **Deployment Verification**: Automated deployment validation scripts

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ HTTP POST /api/orders/execute
       ▼
┌─────────────────────┐
│  Fastify Server     │
│  OrderController    │
└──────┬──────────────┘
       │
       ├──────────────────┐
       │                  │
       ▼                  ▼
┌─────────────┐    ┌──────────────┐
│  MongoDB    │    │  Redis Queue │
│  (Orders)   │    │  (BullMQ)    │
└─────────────┘    └──────┬───────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ OrderWorker  │
                   │ (10 workers) │
                   └──────┬───────┘
                          │
                          ▼
                   ┌──────────────┐
                   │ OrderService │
                   └──────┬───────┘
                          │
       ┌──────────────────┼──────────────────┐
       ▼                  ▼                  ▼
┌─────────────┐    ┌─────────────┐   ┌─────────────┐
│ DexRouter   │    │  WebSocket  │   │  OrderRepo  │
│ Service     │    │  Manager    │   │             │
└──────┬──────┘    └──────┬──────┘   └─────────────┘
       │                  │
       │                  │ Real-time updates
       ▼                  ▼
┌─────────────────────────────┐
│    Raydium    │   Meteora   │
│   (0.3% fee)  │  (0.2% fee) │
└─────────────────────────────┘
```

## Trading Pairs

| Pair | Base Price | Quote Currency |
|------|------------|----------------|
| BTC/USDT | ~$43,000 | USDT |
| ETH/USDT | ~$2,300 | USDT |
| BTC/ETH | ~18.7 | ETH |

## DEX Comparison

| DEX | Fee | Success Rate | Quote Time | Execution Time |
|-----|-----|--------------|------------|----------------|
| Raydium | 0.3% | 95% | 200ms | 2-3s |
| Meteora | 0.2% | 97% | 200ms | 2-3s |

**Routing Logic**: Parallel quote fetching from both DEXs, selects the one with highest net output after fees.

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Web Framework**: Fastify
- **Database**: MongoDB (Mongoose ODM)
- **Queue**: Redis + BullMQ
- **WebSocket**: @fastify/websocket
- **Testing**: Jest, Supertest
- **Hosting**: Railway

## Prerequisites

- Node.js >= 18.0.0
- MongoDB (local or cloud)
- Redis (local or cloud)
- npm or yarn

## Installation

```bash
# Clone repository
git clone <repository-url>
cd eterna_project

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration
```

## Environment Variables

```env
# Server
PORT=3000
NODE_ENV=development

# MongoDB
MONGODB_URI=mongodb://localhost:27017/dex-order-engine

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Queue
QUEUE_CONCURRENCY=10
QUEUE_RATE_LIMIT=100

# Trading Mode
MOCK_MODE=true                              # true = mock mode, false = real Solana devnet

# Solana Configuration (Required for Real Mode)
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet                       # devnet, mainnet-beta
WALLET_PRIVATE_KEY=                         # Base58 encoded private key (keep secret!)
```

## Setup

### 1. Start MongoDB
```bash
# Local MongoDB
mongod --dbpath /path/to/data

# Or use MongoDB Atlas (cloud)
```

### 2. Start Redis
```bash
# Local Redis
redis-server

# Or use Redis Cloud
```

### 3. Initialize Database
```bash
npm run setup-db
```

### 4. Start Development Server
```bash
npm run dev
```

Server starts at `http://localhost:3000`

## Operating Modes

The engine supports two operating modes:

### Mock Mode (Default)
- **Use Case**: Development, testing, CI/CD pipelines
- **Configuration**: `MOCK_MODE=true` in `.env`
- **Behavior**: Simulates DEX operations without blockchain interaction
- **Advantages**: Fast, deterministic, no blockchain dependencies
- **Limitations**: No real blockchain transactions

### Real Devnet Mode
- **Use Case**: Integration testing with Solana devnet
- **Configuration**: `MOCK_MODE=false` in `.env`
- **Behavior**: Connects to Solana devnet and simulates swaps with real network latency
- **Prerequisites**:
  - Valid Solana wallet keypair
  - Devnet SOL for transaction fees (airdrop available)
  - RPC endpoint configured
- **See**: [DEVNET_GUIDE.md](DEVNET_GUIDE.md) for complete setup instructions

### Quick Mode Switching

**Switch to Mock Mode:**
```bash
# In .env
MOCK_MODE=true

# Restart server
npm run dev
```

**Switch to Real Devnet Mode:**
```bash
# In .env
MOCK_MODE=false
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet
WALLET_PRIVATE_KEY=your_base58_private_key

# Restart server
npm run dev
```

The system automatically detects the mode and initializes appropriate DEX services:
- Mock Mode: Uses `MockRaydiumService` and `MockMeteoraService`
- Real Mode: Uses `RealRaydiumService` and `RealMeteoraService`

## API Endpoints

### Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-20T10:30:00.000Z",
  "uptime": 3600,
  "database": "connected",
  "redis": "connected",
  "queue": {
    "waiting": 5,
    "active": 3,
    "completed": 120,
    "failed": 2,
    "delayed": 0,
    "total": 130
  }
}
```

### Execute Order
```http
POST /api/orders/execute
Content-Type: application/json

{
  "type": "MARKET",
  "pair": "BTC/USDT",
  "amount": 0.5,
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

**Response:**
```json
{
  "orderId": "65abc123def456789",
  "status": "PENDING",
  "message": "Order received and queued for processing",
  "websocket": "/api/orders/65abc123def456789/ws"
}
```

### Get Order
```http
GET /api/orders/:orderId
```

**Response:**
```json
{
  "_id": "65abc123def456789",
  "type": "MARKET",
  "pair": "BTC/USDT",
  "amount": 0.5,
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "status": "CONFIRMED",
  "dexUsed": "Meteora",
  "executedPrice": 42856.50,
  "receivedAmount": 21385.50,
  "fee": 42.77,
  "txHash": "0x1234567890abcdef...",
  "statusHistory": [...],
  "createdAt": "2025-01-20T10:30:00.000Z",
  "updatedAt": "2025-01-20T10:30:05.000Z"
}
```

### List Orders
```http
GET /api/orders?status=CONFIRMED&pair=BTC/USDT&limit=10&page=1
```

**Query Parameters:**
- `status`: Filter by order status (PENDING, ROUTING, BUILDING, SUBMITTED, CONFIRMED, FAILED)
- `pair`: Filter by trading pair (BTC/USDT, ETH/USDT, BTC/ETH)
- `limit`: Orders per page (default: 50)
- `page`: Page number (default: 1)

## WebSocket

### Order-Specific Stream
```javascript
const ws = new WebSocket('ws://localhost:3000/api/orders/:orderId/ws');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

**Messages received:**

1. Connection confirmation:
```json
{
  "type": "connected",
  "clientId": "client-abc123",
  "subscribedTo": "65abc123def456789"
}
```

2. Status updates:
```json
{
  "type": "status_update",
  "orderId": "65abc123def456789",
  "status": "ROUTING",
  "timestamp": "2025-01-20T10:30:01.000Z",
  "metadata": {
    "message": "Fetching quotes from DEXs"
  }
}
```

### General Stream
```javascript
const ws = new WebSocket('ws://localhost:3000/api/orders/ws');

// Subscribe to specific order
ws.send(JSON.stringify({
  action: "subscribe",
  orderId: "65abc123def456789"
}));

// Unsubscribe
ws.send(JSON.stringify({
  action: "unsubscribe",
  orderId: "65abc123def456789"
}));
```

## Order Lifecycle

```
PENDING → ROUTING → BUILDING → SUBMITTED → CONFIRMED
                                            ↓
                                         FAILED
```

| Status | Description | Duration |
|--------|-------------|----------|
| PENDING | Order received, queued | Instant |
| ROUTING | Fetching quotes from DEXs | ~200ms |
| BUILDING | Building transaction with selected DEX | ~1s |
| SUBMITTED | Transaction submitted to blockchain | ~2-3s |
| CONFIRMED | Transaction confirmed | Final |
| FAILED | Transaction failed or error occurred | Final |

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- OrderService.test.ts

# Run in watch mode
npm test -- --watch
```

**Test Coverage**: 69+ tests across all components

## Project Structure

```
eterna_project/
├── src/
│   ├── app.ts                    # Fastify application setup
│   ├── server.ts                 # Server entry point
│   ├── config/
│   │   ├── database.ts           # MongoDB connection
│   │   └── redis.ts              # Redis connection
│   ├── types/
│   │   └── order.types.ts        # TypeScript types/enums
│   ├── models/
│   │   └── Order.model.ts        # Mongoose schema
│   ├── repositories/
│   │   └── OrderRepository.ts    # Database operations
│   ├── services/
│   │   ├── OrderService.ts       # Business logic
│   │   ├── WebSocketManager.ts   # WebSocket handling
│   │   └── dex/
│   │       ├── DexRouterService.ts
│   │       ├── MockRaydiumService.ts
│   │       └── MockMeteoraService.ts
│   ├── controllers/
│   │   └── OrderController.ts    # HTTP handlers
│   ├── queue/
│   │   ├── orderQueue.ts         # BullMQ queue setup
│   │   └── orderWorker.ts        # Queue worker
│   ├── router/
│   │   └── orderRoutes.ts        # Route definitions
│   └── utils/
│       ├── errors.ts             # Custom error classes
│       ├── priceCalculator.ts    # Price simulation
│       └── sleep.ts              # Utility functions
├── tests/                         # Test files
├── scripts/
│   └── setup-db.ts               # Database initialization
├── postman/
│   ├── DEX_Order_Engine.postman_collection.json
│   └── README.md
├── package.json
├── tsconfig.json
└── README.md
```

## Scripts

```bash
# Development
npm run dev              # Start with hot reload
npm run build            # Build TypeScript
npm start                # Start production server

# Database
npm run setup-db         # Initialize database indexes

# Testing
npm test                 # Run tests
npm run test:coverage    # Run with coverage

# Linting
npm run lint             # Check code style
npm run lint:fix         # Fix code style issues
```

## Error Handling

Custom error classes with appropriate HTTP status codes:

| Error Class | Status Code | Usage |
|-------------|-------------|-------|
| ValidationError | 400 | Invalid request parameters |
| NotFoundError | 404 | Resource not found |
| OrderProcessingError | 500 | Order processing failure |
| DexExecutionError | 500 | DEX execution failure |
| DatabaseError | 500 | Database operation failure |
| QueueError | 500 | Queue operation failure (with graceful degradation) |
| WebSocketError | 500 | WebSocket operation failure |

## Rate Limiting

- **Concurrent Orders**: 10 simultaneous
- **Rate Limit**: 100 orders per minute
- **Retry Policy**: Exponential backoff (1s, 2s, 4s) with max 3 attempts

## Monitoring & Health Checks

The system includes comprehensive monitoring capabilities for production operations.

### Health Endpoints

**System Health** - `GET /health`
```bash
curl http://localhost:3000/health
```

Returns complete system status including:
- Overall system health (healthy/degraded/unhealthy)
- Component health (Database, Redis, Queue, Solana RPC)
- Performance metrics (memory, CPU, queue stats)
- Trading mode (mock/real)

**Mode Information** - `GET /health/mode`
```bash
curl http://localhost:3000/health/mode
```

Returns trading mode configuration and settings.

**Performance Metrics** - `GET /health/metrics`
```bash
curl http://localhost:3000/health/metrics
```

Returns detailed performance metrics for monitoring dashboards.

### Component Monitoring

**Database (MongoDB)**
- Connection state tracking
- Host and database information
- Real-time connection status

**Redis**
- Connectivity checks via PING
- Connection health validation
- Stats collection

**Queue (BullMQ)**
- Failure rate monitoring (healthy < 10%, degraded < 20%, unhealthy > 20%)
- Throughput tracking
- Active/waiting/completed job counts

**Solana RPC** (Real Mode only)
- RPC connectivity validation
- Network status (devnet/mainnet-beta)
- Current slot tracking
- Version information

### Deployment Verification

Automated verification script for CI/CD:

```bash
# Local verification
npm run verify-deployment

# Remote verification
DEPLOYMENT_URL=https://your-app.railway.app npm run verify-deployment
```

Performs 5 comprehensive checks:
1. System health validation
2. Mode detection
3. Performance metrics
4. Order execution flow
5. API endpoint availability

## Production Deployment

### Railway Deployment

1. Create Railway project
2. Add MongoDB and Redis addons
3. Configure environment variables
4. Deploy from GitHub repository
5. Railway will automatically:
   - Install dependencies
   - Build TypeScript
   - Start the server

### Environment Configuration

```env
NODE_ENV=production
PORT=${PORT}  # Railway provides this
MONGODB_URI=${MONGODB_URL}  # From MongoDB addon
REDIS_HOST=${REDIS_HOST}    # From Redis addon
REDIS_PORT=${REDIS_PORT}
REDIS_PASSWORD=${REDIS_PASSWORD}
```

## Postman Collection

Import the Postman collection from `postman/DEX_Order_Engine.postman_collection.json` for easy API testing.

See [postman/README.md](postman/README.md) for detailed usage instructions.

## Monitoring

### Health Endpoint
Monitor system health and queue metrics via `/health` endpoint.

### Logs
Structured logging with Pino:
```json
{
  "level": "info",
  "time": 1705747200000,
  "msg": "Order status updated",
  "orderId": "65abc123def456789",
  "status": "CONFIRMED"
}
```

## Performance Metrics

- **Order Submission**: < 100ms
- **Quote Fetching**: ~200ms per DEX
- **Order Processing**: 2-5s (end-to-end)
- **WebSocket Latency**: < 50ms

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check MongoDB is running
mongosh

# Verify connection string in .env
MONGODB_URI=mongodb://localhost:27017/dex-order-engine
```

### Redis Connection Issues
```bash
# Check Redis is running
redis-cli ping
# Should return: PONG

# Check Redis connection in logs
npm run dev
# Look for: "Redis connected successfully"
```

### Queue Not Processing
```bash
# Check queue metrics
curl http://localhost:3000/health

# Check worker is running
# Look for logs: "Worker started with concurrency: 10"
```

### WebSocket Connection Fails
- Ensure using `ws://` protocol (not `wss://` for local)
- Check firewall settings
- Verify order ID exists

### Real Devnet Mode Issues

**RPC Connection Failures:**
```bash
# Test RPC connectivity
curl https://api.devnet.solana.com -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'

# Try alternative RPC endpoints (see DEVNET_GUIDE.md)
SOLANA_RPC_URL=https://devnet.helius-rpc.com
```

**Wallet/Keypair Issues:**
```bash
# Generate new keypair
npm run generate-keypair

# Check wallet balance
npm run check-balance

# Request devnet SOL airdrop
npm run airdrop
```

**Insufficient Balance:**
```bash
# Ensure at least 0.01 SOL for transaction fees
npm run check-balance

# Request airdrop (devnet only, 1-2 SOL)
npm run airdrop
```

**Configuration Validation Errors:**
```bash
# Run configuration validation
npm run validate-setup

# Common fixes:
# - Check WALLET_PRIVATE_KEY is base58 encoded
# - Verify SOLANA_RPC_URL is accessible
# - Ensure SOLANA_NETWORK matches RPC endpoint (devnet/mainnet-beta)
```





