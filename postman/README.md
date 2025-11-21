# Postman Collection Usage Guide

## Import Instructions

1. Open Postman
2. Click "Import" button
3. Select `DEX_Order_Engine.postman_collection.json`
4. Collection will appear in your Collections sidebar

## Environment Setup

### Local Development

Set these variables in Postman:
- `BASE_URL`: `http://localhost:3000`
- `WS_URL`: `localhost:3000`

### Production (Railway)

- `BASE_URL`: `https://your-app.railway.app`
- `WS_URL`: `your-app.railway.app`

## Testing Workflow

### 1. Health Check
Start by verifying the API is running:
```
GET /health
```

### 2. Execute an Order
Submit a market order (example: BTC/USDT):
```
POST /api/orders/execute
```
Save the returned `orderId` from the response.

### 3. Monitor via WebSocket
Use the WebSocket endpoint with the `orderId`:
```
WS /api/orders/:orderId/ws
```

### 4. Check Order Status (HTTP)
Alternatively, poll the order status:
```
GET /api/orders/:orderId
```

### 5. List Orders
View all orders with filters:
```
GET /api/orders?status=CONFIRMED&pair=BTC/USDT&limit=10
```

## WebSocket Testing in Postman

Postman supports WebSocket connections:

1. Create a new WebSocket request
2. Enter URL: `ws://localhost:3000/api/orders/:orderId/ws`
3. Replace `:orderId` with actual order ID
4. Click "Connect"
5. Watch real-time updates in the Messages panel

### WebSocket Message Types

**Connection confirmation:**
```json
{
  "type": "connected",
  "clientId": "client-abc123",
  "subscribedTo": "65abc123def456789"
}
```

**Status update:**
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

**Manual subscription (general stream):**
```json
{
  "action": "subscribe",
  "orderId": "65abc123def456789"
}
```

## Test Scenarios

### Single Order Flow
1. Execute Order → Save orderId
2. Connect WebSocket → Watch status changes
3. Verify final status (CONFIRMED/FAILED)

### All Trading Pairs
Execute orders for each pair:
- BTC/USDT (amount: 0.5)
- ETH/USDT (amount: 10)
- BTC/ETH (amount: 0.25)

### Concurrent Orders
Use the "Runner" feature:
1. Select "Execute Order" requests
2. Run all 3 pairs simultaneously
3. Monitor each via WebSocket

### Error Scenarios
Test validation errors:
- Invalid pair: `{"pair": "INVALID/PAIR", ...}`
- Negative amount: `{"amount": -1, ...}`
- Missing wallet: `{"walletAddress": "", ...}`

## Expected Response Times

- Health check: < 50ms
- Order submission: < 100ms
- Order processing: 2-5 seconds (via WebSocket updates)

## Status Flow Timeline

```
PENDING (0s)
  ↓
ROUTING (0-1s) - Fetching DEX quotes
  ↓
BUILDING (1-2s) - Selecting best DEX
  ↓
SUBMITTED (2-3s) - Transaction sent
  ↓
CONFIRMED/FAILED (3-5s) - Final status
```
