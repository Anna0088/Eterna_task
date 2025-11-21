# Testing Guide

Comprehensive guide for testing the DEX Order Execution Engine.

## Table of Contents

1. [Unit & Integration Tests](#unit--integration-tests)
2. [Manual Testing Scripts](#manual-testing-scripts)
3. [Test Scenarios](#test-scenarios)
4. [Performance Testing](#performance-testing)

---

## Unit & Integration Tests

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run in watch mode
npm test -- --watch

# Run specific test file
npm test -- OrderService.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="should process order"
```

### Test Structure

```
tests/
├── unit/
│   ├── services/
│   │   ├── OrderService.test.ts
│   │   ├── DexRouterService.test.ts
│   │   └── WebSocketManager.test.ts
│   ├── repositories/
│   │   └── OrderRepository.test.ts
│   └── utils/
│       └── priceCalculator.test.ts
├── integration/
│   ├── api.test.ts
│   ├── queue.test.ts
│   └── websocket.test.ts
└── setup.ts
```

### Test Coverage

Current coverage: **69+ tests** across all components

Key areas covered:
- Order creation and validation
- DEX routing logic
- Queue management
- WebSocket broadcasting
- Error handling
- Database operations

---

## Manual Testing Scripts

### Prerequisites

Ensure the development server is running:

```bash
# Terminal 1: Start the server
npm run dev

# Terminal 2: Run test scripts
```

### 1. Single Order Test

Tests a single order execution with detailed monitoring.

**Run:**
```bash
npm run test:single
```

**What it does:**
- Submits a BTC/USDT market order
- Connects to WebSocket for real-time updates
- Displays status changes with timestamps
- Shows final order details

**Expected output:**
```
============================================================
🧪 DEX Order Engine - Single Order Test
============================================================

📤 Submitting BTC/USDT order for 0.5 units...
✅ Order created: 65abc123def456789
   Status: PENDING

🔌 Connecting to WebSocket for order 65abc123def456789...
✅ WebSocket connected
📡 Subscribed to order updates (Client ID: client-abc123)

⏱️  [0.20s] Status: ROUTING
   📝 Fetching quotes from DEXs

⏱️  [1.50s] Status: BUILDING
   🏦 DEX: Meteora
   💡 Reason: Better output by 1.2%

⏱️  [2.80s] Status: SUBMITTED
   🔗 Transaction Hash: 0x1234567890...

⏱️  [4.50s] Status: CONFIRMED
   💰 Executed Price: $42856.50
   💵 Received Amount: $21385.50
   💸 Fee: $42.77

🏁 Order CONFIRMED in 4.50s
```

**Duration:** ~5-10 seconds

---

### 2. Concurrent Orders Test

Tests multiple simultaneous orders (default: 5).

**Run:**
```bash
# Default: 5 concurrent orders
npm run test:concurrent

# Custom number (1-10 orders)
npm run test:concurrent 3
```

**What it does:**
- Submits 3-5 orders simultaneously
- Monitors all orders via separate WebSocket connections
- Tracks execution time for each order
- Displays comprehensive summary

**Expected output:**
```
======================================================================
🚀 DEX Order Engine - Concurrent Orders Test (5 orders)
======================================================================

📤 Submitting orders concurrently...

🟡 Submitting Order #1: BTC/USDT (0.5 units)
🔵 Submitting Order #2: ETH/USDT (10 units)
🟣 Submitting Order #3: BTC/ETH (0.25 units)
🟢 Submitting Order #4: BTC/USDT (1.0 units)
🔴 Submitting Order #5: ETH/USDT (5 units)

✅ All 5 orders submitted successfully!

----------------------------------------------------------------------
📡 Monitoring order execution via WebSocket...

🟡 Order #1 (65abc123...): WebSocket connected
🟡 Order #1 [0.15s]: ROUTING
🟡 Order #1 [1.20s]: BUILDING
   └─ DEX: Meteora | Reason: Better output by 0.8%
🟡 Order #1 [3.50s]: CONFIRMED

[... similar output for orders #2-5 ...]

======================================================================
📊 EXECUTION SUMMARY
======================================================================

🟡 Order #1:
   Pair: BTC/USDT
   Amount: 0.5
   Status: ✅ CONFIRMED
   Duration: 3.50s
   Executed Price: $42856.50
   Received Amount: $21385.50
   Fee: $42.77

[... similar output for orders #2-5 ...]

----------------------------------------------------------------------
📈 STATISTICS:
   Total Orders: 5
   Confirmed: 5
   Failed: 0
   Success Rate: 100.0%
   Average Execution Time: 3.82s
   Total Test Duration: 5.20s
======================================================================
```

**Duration:** ~5-8 seconds

---

### 3. Stress Test

Tests system performance under high load (default: 20 orders).

**Run:**
```bash
# Default: 20 orders in batches of 10
npm run test:stress

# Custom: 50 orders in batches of 5
npm run test:stress 50 5
```

**Parameters:**
- First argument: Total number of orders (1-100)
- Second argument: Batch size (1-20)

**What it does:**
- Submits orders in batches with random trading pairs
- Tests queue rate limiting (100/min)
- Tests concurrency limit (10 simultaneous)
- Monitors system health

**Expected output:**
```
======================================================================
⚡ DEX Order Engine - Stress Test
======================================================================
   Total Orders: 20
   Batch Size: 10
   Expected Queue Rate Limit: 100 orders/minute
   Expected Concurrency: 10 simultaneous orders
======================================================================

📊 Progress: 20/20 submitted | ✅ 19 confirmed | ❌ 1 failed | ⚠️  0 errors | ⏱️  15.3s

======================================================================
📊 STRESS TEST RESULTS
======================================================================

📈 OVERALL STATISTICS:
   Total Orders Submitted: 20
   Confirmed: 19 (95.0%)
   Failed: 1 (5.0%)
   Errors: 0 (0.0%)
   Total Duration: 15.30s
   Throughput: 1.31 orders/second

⏱️  EXECUTION TIME STATISTICS:
   Average: 4.20s
   Minimum: 3.10s
   Maximum: 5.80s

💱 TRADING PAIR DISTRIBUTION:
   BTC/USDT: 7 orders (7 confirmed, 100.0% success)
   ETH/USDT: 8 orders (7 confirmed, 87.5% success)
   BTC/ETH: 5 orders (5 confirmed, 100.0% success)

🏥 SYSTEM HEALTH CHECK:
   Database: connected
   Redis: connected
   Queue Status:
     - Waiting: 0
     - Active: 0
     - Completed: 19
     - Failed: 1
     - Total Processed: 20

======================================================================
✅ Stress test completed successfully!
======================================================================
```

**Duration:** ~15-30 seconds (depends on order count)

---

### 4. All Trading Pairs Test

Tests all supported trading pairs (BTC/USDT, ETH/USDT, BTC/ETH).

**Run:**
```bash
npm run test:all-pairs
```

**What it does:**
- Submits one order for each trading pair
- Monitors all orders concurrently
- Validates DEX selection logic
- Fetches final order details via API

**Expected output:**
```
======================================================================
💱 DEX Order Engine - All Trading Pairs Test
======================================================================

Testing all supported trading pairs:
   🟡 BTC/USDT: 0.5 units (Bitcoin to USDT)
   🔵 ETH/USDT: 10 units (Ethereum to USDT)
   🟣 BTC/ETH: 0.25 units (Bitcoin to Ethereum)

======================================================================

📤 Submitting orders for all pairs...

🟡 Submitting BTC/USDT order...
   ✅ Order ID: 65abc123def456789

🔵 Submitting ETH/USDT order...
   ✅ Order ID: 65abc456def789012

🟣 Submitting BTC/ETH order...
   ✅ Order ID: 65abc789def012345

======================================================================
📡 Monitoring all orders via WebSocket...

[... real-time updates for all 3 pairs ...]

======================================================================
📊 TEST RESULTS
======================================================================

🟡 BTC/USDT:
   Status: ✅ CONFIRMED
   Amount: 0.5
   Duration: 4.20s
   DEX Used: Meteora
   Executed Price: $42856.50
   Received Amount: $21385.50
   Fee: $42.77
   Fee Percentage: 0.20%

[... similar output for ETH/USDT and BTC/ETH ...]

----------------------------------------------------------------------
📈 STATISTICS:
   Total Pairs Tested: 3
   Confirmed: 3
   Failed: 0
   Success Rate: 100.0%
   Average Execution Time: 4.15s
   Total Test Duration: 6.50s

🏦 DEX USAGE:
   Meteora: 2 orders (66.7%)
   Raydium: 1 orders (33.3%)

======================================================================
✅ All trading pairs tested successfully!
======================================================================
```

**Duration:** ~6-8 seconds

---

### 5. Demo Script (Video Ready)

Colorful, animated demo for video recording.

**Run:**
```bash
npm run demo
```

**What it does:**
- Clears terminal and displays animated banner
- Performs system health check
- Demos single order execution
- Demos concurrent order execution
- Shows final statistics
- Uses ANSI colors and emojis

**Expected output:**
```
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║              🚀 DEX ORDER EXECUTION ENGINE 🚀              ║
║                                                                   ║
║             Multi-DEX Routing • Real-time Updates              ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝

━━━ SYSTEM HEALTH CHECK ━━━

⏳ Checking system status...
✓ Status: OK
✓ Database: connected
✓ Redis: connected
✓ Queue System: OPERATIONAL

  Queue Metrics:
    • Waiting: 0
    • Active: 0
    • Completed: 120
    • Failed: 2

━━━ DEMO: SINGLE ORDER EXECUTION ━━━

📝 Creating order:
   • Trading Pair: BTC/USDT
   • Amount: 0.5 BTC
   • Type: MARKET

✓ Order Submitted
   Order ID: 65abc123def456789

📡 Monitoring real-time status updates via WebSocket...

🟡 [0.15s] ⏳ PENDING
🟡 [0.20s] 🔍 ROUTING
    ├─ Fetching quotes from DEXs
🟡 [1.50s] 🔨 BUILDING
    ├─ DEX Selected: Meteora
    ├─ Reason: Better output by 1.2%
🟡 [2.80s] 📤 SUBMITTED
    ├─ TX Hash: 0x12345678...
🟡 [4.50s] ✅ CONFIRMED
    ├─ Price: $42856.50
    ├─ Received: $21385.50
    └─ Fee: $42.77

🎉 Order CONFIRMED in 4.50s

[... continues with concurrent orders demo ...]

╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║                     ✨ DEMO COMPLETED ✨                     ║
║                                                                   ║
║         Features Demonstrated:                             ║
║           • Multi-DEX Intelligent Routing                      ║
║           • Real-time WebSocket Updates                        ║
║           • Concurrent Order Processing                        ║
║           • Multiple Trading Pairs (BTC, ETH)                  ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
```

**Duration:** ~12-15 seconds

**Perfect for:**
- Video demonstrations
- Client presentations
- Feature showcases

---

## Test Scenarios

### Happy Path Scenarios

#### 1. Single Order Success
```bash
npm run test:single
```
Expected: Order goes through all states and reaches CONFIRMED.

#### 2. Multiple Pairs Success
```bash
npm run test:all-pairs
```
Expected: All 3 trading pairs execute successfully.

#### 3. Concurrent Processing
```bash
npm run test:concurrent 10
```
Expected: All 10 orders process in ~5 seconds due to concurrency.

### Edge Case Scenarios

#### 1. Rate Limiting
```bash
# Submit 150 orders (exceeds 100/min limit)
npm run test:stress 150 50
```
Expected: Some orders queued/delayed, but all eventually process.

#### 2. Concurrency Limit
```bash
# Submit 20 concurrent orders (exceeds 10 limit)
npm run test:concurrent 20
```
Expected: Max 10 active at once, others queued.

#### 3. DEX Selection Variance
```bash
# Run multiple times to see different DEX selections
npm run test:all-pairs
npm run test:all-pairs
npm run test:all-pairs
```
Expected: Meteora selected ~60-70% of time (due to lower fees).

### Error Scenarios

Test via Postman or curl:

#### 1. Invalid Trading Pair
```bash
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{"type":"MARKET","pair":"INVALID/PAIR","amount":1,"walletAddress":"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}'
```
Expected: 400 Bad Request

#### 2. Negative Amount
```bash
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{"type":"MARKET","pair":"BTC/USDT","amount":-1,"walletAddress":"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"}'
```
Expected: 400 Bad Request

#### 3. Invalid Wallet
```bash
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{"type":"MARKET","pair":"BTC/USDT","amount":1,"walletAddress":"invalid"}'
```
Expected: 400 Bad Request

#### 4. Order Not Found
```bash
curl http://localhost:3000/api/orders/invalidorderid123
```
Expected: 404 Not Found

---

## Performance Testing

### Benchmarks

| Metric | Target | Test Method |
|--------|--------|-------------|
| Order Submission | < 100ms | `npm run test:single` |
| Order Processing | 3-5s | `npm run test:single` |
| WebSocket Latency | < 50ms | `npm run demo` |
| Concurrent Throughput | 10 orders/sec | `npm run test:concurrent 10` |
| Queue Rate Limit | 100 orders/min | `npm run test:stress 100` |

### Measuring Performance

#### 1. Single Order Latency
```bash
# Run 10 times and average
for i in {1..10}; do npm run test:single; done
```
Average should be 3-5 seconds.

#### 2. Concurrent Throughput
```bash
npm run test:concurrent 10
```
Check "Total Test Duration" - should be ~5 seconds for 10 orders.

#### 3. Stress Test Throughput
```bash
npm run test:stress 100 10
```
Check "Throughput" metric - should be ~1-2 orders/second.

### Performance Considerations

**Factors affecting performance:**
- MongoDB query performance
- Redis connection speed
- Mock DEX delay (200ms quote + 2-3s execution)
- WebSocket broadcast overhead
- Network latency

**Optimization tips:**
- Use MongoDB indexes (already configured)
- Use Redis pipelining for batch operations
- Adjust `QUEUE_CONCURRENCY` in .env
- Optimize WebSocket message size

---

## Troubleshooting

### Test Script Errors

#### "Connection refused"
**Cause:** Server not running

**Solution:**
```bash
npm run dev
```

#### "WebSocket timeout"
**Cause:** Order processing took too long (>30s)

**Solution:**
- Check MongoDB and Redis connections
- Check queue worker is running
- Increase timeout in test script

#### "Module not found: ws"
**Cause:** ws package not installed

**Solution:**
```bash
npm install
```

### Performance Issues

#### Orders taking >10 seconds
**Check:**
1. MongoDB indexes created: `npm run setup:db`
2. Redis running: `redis-cli ping`
3. Queue worker active: Check logs for "Worker started"

#### Low success rate (<80%)
**Check:**
1. Mock DEX success rates (95% Raydium, 97% Meteora)
2. Network issues
3. Database connection stability

---

## CI/CD Testing

### GitHub Actions Example

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      mongodb:
        image: mongo:5
        ports:
          - 27017:27017

      redis:
        image: redis:6
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - run: npm install
      - run: npm run build
      - run: npm test
      - run: npm run test:coverage

      # Optional: Run manual tests
      - name: Start server
        run: npm run dev &
        env:
          NODE_ENV: test

      - name: Wait for server
        run: sleep 10

      - name: Run manual tests
        run: |
          npm run test:single
          npm run test:all-pairs
```

---

## Next Steps

After testing locally:
1. Deploy to Railway (Phase 8)
2. Run tests against production
3. Record demo video
4. Prepare final deliverables
