# API Documentation

Complete API reference for the DEX Order Execution Engine.

## Base URL

- **Local**: `http://localhost:3000`
- **Production**: `https://your-app.railway.app`

## Authentication

Currently, the API does not require authentication (planned for future release).

---

## Endpoints

### Health Check

Check API health status and system metrics.

**Endpoint**: `GET /health`

**Response**: `200 OK`

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

**Fields**:
- `status`: Overall health status ("ok" or "error")
- `timestamp`: Current server timestamp
- `uptime`: Server uptime in seconds
- `database`: MongoDB connection status
- `redis`: Redis connection status
- `queue`: BullMQ queue metrics

---

### Execute Order

Submit a new market order for execution.

**Endpoint**: `POST /api/orders/execute`

**Headers**:
```
Content-Type: application/json
```

**Request Body**:

```json
{
  "type": "MARKET",
  "pair": "BTC/USDT",
  "amount": 0.5,
  "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
}
```

**Parameters**:
- `type` (string, required): Order type. Currently only "MARKET" is supported.
- `pair` (string, required): Trading pair. Options: "BTC/USDT", "ETH/USDT", "BTC/ETH"
- `amount` (number, required): Amount to trade (must be > 0)
- `walletAddress` (string, required): Wallet address (must start with "0x" and be 42 characters)

**Response**: `200 OK`

```json
{
  "orderId": "65abc123def456789",
  "status": "PENDING",
  "message": "Order received and queued for processing",
  "websocket": "/api/orders/65abc123def456789/ws"
}
```

**Fields**:
- `orderId`: Unique order identifier (use this to track order status)
- `status`: Initial order status (always "PENDING")
- `message`: Confirmation message
- `websocket`: WebSocket endpoint for real-time updates

**Error Responses**:

`400 Bad Request` - Validation error:
```json
{
  "error": "Validation Error",
  "message": "Invalid order type",
  "code": "VALIDATION_ERROR",
  "statusCode": 400
}
```

`500 Internal Server Error` - Queue error (graceful degradation):
```json
{
  "orderId": "65abc123def456789",
  "status": "PENDING",
  "message": "Order created but queue processing may be delayed. Use GET /api/orders/:orderId to check status.",
  "warning": "Queue system temporarily unavailable"
}
```

**Examples**:

BTC/USDT order:
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

ETH/USDT order:
```bash
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "MARKET",
    "pair": "ETH/USDT",
    "amount": 10,
    "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }'
```

BTC/ETH order:
```bash
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "type": "MARKET",
    "pair": "BTC/ETH",
    "amount": 0.25,
    "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
  }'
```

---

### Get Order

Retrieve order details by order ID.

**Endpoint**: `GET /api/orders/:orderId`

**URL Parameters**:
- `orderId` (string, required): Order identifier

**Response**: `200 OK`

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
  "txHash": "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "statusHistory": [
    {
      "status": "PENDING",
      "timestamp": "2025-01-20T10:30:00.000Z"
    },
    {
      "status": "ROUTING",
      "timestamp": "2025-01-20T10:30:01.000Z",
      "metadata": {
        "message": "Fetching quotes from DEXs"
      }
    },
    {
      "status": "BUILDING",
      "timestamp": "2025-01-20T10:30:01.500Z",
      "metadata": {
        "dex": "Meteora",
        "reason": "Better output by 1.2%"
      }
    },
    {
      "status": "SUBMITTED",
      "timestamp": "2025-01-20T10:30:03.000Z",
      "metadata": {
        "txHash": "0x1234567890abcdef..."
      }
    },
    {
      "status": "CONFIRMED",
      "timestamp": "2025-01-20T10:30:05.000Z"
    }
  ],
  "createdAt": "2025-01-20T10:30:00.000Z",
  "updatedAt": "2025-01-20T10:30:05.000Z"
}
```

**Fields**:
- `_id`: Order ID
- `type`: Order type
- `pair`: Trading pair
- `amount`: Order amount
- `walletAddress`: User's wallet address
- `status`: Current status (PENDING, ROUTING, BUILDING, SUBMITTED, CONFIRMED, FAILED)
- `dexUsed`: DEX used for execution (Raydium or Meteora)
- `executedPrice`: Actual execution price
- `receivedAmount`: Amount received after fees
- `fee`: Trading fee charged
- `txHash`: Blockchain transaction hash
- `statusHistory`: Array of status changes with timestamps and metadata
- `createdAt`: Order creation timestamp
- `updatedAt`: Last update timestamp

**Error Responses**:

`404 Not Found`:
```json
{
  "error": "Not Found",
  "message": "Order not found",
  "code": "NOT_FOUND",
  "statusCode": 404
}
```

**Example**:

```bash
curl http://localhost:3000/api/orders/65abc123def456789
```

---

### List Orders

Retrieve a list of orders with optional filtering and pagination.

**Endpoint**: `GET /api/orders`

**Query Parameters**:
- `status` (string, optional): Filter by status. Options: PENDING, ROUTING, BUILDING, SUBMITTED, CONFIRMED, FAILED
- `pair` (string, optional): Filter by trading pair. Options: BTC/USDT, ETH/USDT, BTC/ETH
- `limit` (number, optional): Number of orders per page (default: 50, max: 100)
- `page` (number, optional): Page number (default: 1)

**Response**: `200 OK`

```json
{
  "orders": [
    {
      "_id": "65abc123def456789",
      "type": "MARKET",
      "pair": "BTC/USDT",
      "amount": 0.5,
      "status": "CONFIRMED",
      "createdAt": "2025-01-20T10:30:00.000Z"
    },
    {
      "_id": "65abc456def789012",
      "type": "MARKET",
      "pair": "ETH/USDT",
      "amount": 10,
      "status": "CONFIRMED",
      "createdAt": "2025-01-20T10:25:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 2,
    "pages": 1
  }
}
```

**Fields**:
- `orders`: Array of order objects (simplified)
- `pagination`: Pagination metadata
  - `page`: Current page number
  - `limit`: Orders per page
  - `total`: Total number of orders matching filters
  - `pages`: Total number of pages

**Error Responses**:

`400 Bad Request` - Invalid parameters:
```json
{
  "error": "Validation Error",
  "message": "Invalid status value",
  "code": "VALIDATION_ERROR",
  "statusCode": 400
}
```

**Examples**:

All orders:
```bash
curl http://localhost:3000/api/orders
```

Filter by status:
```bash
curl "http://localhost:3000/api/orders?status=CONFIRMED&limit=10&page=1"
```

Filter by pair:
```bash
curl "http://localhost:3000/api/orders?pair=BTC/USDT&limit=20"
```

Combine filters:
```bash
curl "http://localhost:3000/api/orders?status=CONFIRMED&pair=BTC/USDT&limit=10&page=1"
```

---

## WebSocket Endpoints

### Order-Specific Stream

Subscribe to real-time updates for a specific order.

**Endpoint**: `WS /api/orders/:orderId/ws`

**URL Parameters**:
- `orderId` (string, required): Order identifier

**Connection**:

```javascript
const ws = new WebSocket('ws://localhost:3000/api/orders/65abc123def456789/ws');

ws.onopen = () => {
  console.log('Connected to order stream');
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Update:', data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from order stream');
};
```

**Messages Received**:

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

3. Error:
```json
{
  "type": "error",
  "message": "Order not found"
}
```

**Status Update Examples**:

ROUTING status:
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

BUILDING status:
```json
{
  "type": "status_update",
  "orderId": "65abc123def456789",
  "status": "BUILDING",
  "timestamp": "2025-01-20T10:30:01.500Z",
  "metadata": {
    "dex": "Meteora",
    "reason": "Better output by 1.2%"
  }
}
```

SUBMITTED status:
```json
{
  "type": "status_update",
  "orderId": "65abc123def456789",
  "status": "SUBMITTED",
  "timestamp": "2025-01-20T10:30:03.000Z",
  "metadata": {
    "txHash": "0x1234567890abcdef..."
  }
}
```

CONFIRMED status:
```json
{
  "type": "status_update",
  "orderId": "65abc123def456789",
  "status": "CONFIRMED",
  "timestamp": "2025-01-20T10:30:05.000Z",
  "metadata": {
    "executedPrice": 42856.50,
    "receivedAmount": 21385.50,
    "fee": 42.77
  }
}
```

FAILED status:
```json
{
  "type": "status_update",
  "orderId": "65abc123def456789",
  "status": "FAILED",
  "timestamp": "2025-01-20T10:30:03.000Z",
  "metadata": {
    "error": "Insufficient liquidity"
  }
}
```

---

### General Stream

Subscribe to multiple orders manually.

**Endpoint**: `WS /api/orders/ws`

**Connection**:

```javascript
const ws = new WebSocket('ws://localhost:3000/api/orders/ws');

ws.onopen = () => {
  // Subscribe to specific order
  ws.send(JSON.stringify({
    action: 'subscribe',
    orderId: '65abc123def456789'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Update:', data);
};
```

**Messages Sent** (Client → Server):

Subscribe to order:
```json
{
  "action": "subscribe",
  "orderId": "65abc123def456789"
}
```

Unsubscribe from order:
```json
{
  "action": "unsubscribe",
  "orderId": "65abc123def456789"
}
```

**Messages Received** (Server → Client):

Same as order-specific stream:
- Connection confirmation
- Status updates
- Errors

**Example: Subscribe to Multiple Orders**:

```javascript
const ws = new WebSocket('ws://localhost:3000/api/orders/ws');

ws.onopen = () => {
  // Subscribe to multiple orders
  ws.send(JSON.stringify({ action: 'subscribe', orderId: 'order1' }));
  ws.send(JSON.stringify({ action: 'subscribe', orderId: 'order2' }));
  ws.send(JSON.stringify({ action: 'subscribe', orderId: 'order3' }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === 'status_update') {
    console.log(`Order ${data.orderId}: ${data.status}`);
  }
};
```

---

## Order Status Lifecycle

```
PENDING → ROUTING → BUILDING → SUBMITTED → CONFIRMED
                                            ↓
                                         FAILED
```

| Status | Description | Typical Duration |
|--------|-------------|------------------|
| PENDING | Order received, queued for processing | Instant |
| ROUTING | Fetching quotes from Raydium and Meteora DEXs | ~200ms |
| BUILDING | Building transaction with selected DEX | ~1s |
| SUBMITTED | Transaction submitted to blockchain | ~2-3s |
| CONFIRMED | Transaction confirmed on blockchain | Final state |
| FAILED | Transaction failed or error occurred | Final state |

---

## Trading Pairs

| Pair | Base Asset | Quote Asset | Base Price |
|------|------------|-------------|------------|
| BTC/USDT | Bitcoin | USDT | ~$43,000 |
| ETH/USDT | Ethereum | USDT | ~$2,300 |
| BTC/ETH | Bitcoin | Ethereum | ~18.7 ETH |

---

## DEX Routing

The system fetches quotes from both DEXs in parallel and selects the one with the best net output.

| DEX | Fee | Success Rate | Characteristics |
|-----|-----|--------------|-----------------|
| Raydium | 0.3% | 95% | Higher prices, higher fees |
| Meteora | 0.2% | 97% | Lower prices, lower fees, often better net output |

**Routing Algorithm**:
1. Fetch quotes from both DEXs in parallel (200ms each)
2. Calculate net output: `estimatedOutput = price * amount * (1 - fee)`
3. Select DEX with highest `estimatedOutput`
4. Return routing decision with percentage difference

**Example Routing Decision**:
```json
{
  "selectedDex": "Meteora",
  "reason": "Meteora better by 1.2%",
  "raydiumOutput": 21342.50,
  "meteoraOutput": 21385.50
}
```

---

## Rate Limiting

- **Concurrent Orders**: Maximum 10 orders processing simultaneously
- **Queue Rate Limit**: 100 orders per minute
- **Retry Policy**: Exponential backoff (1s, 2s, 4s) with max 3 attempts

**Queue Behavior**:
- Orders beyond concurrency limit are queued
- Orders beyond rate limit are delayed
- Failed orders are retried with exponential backoff
- Orders exceeding retry limit are marked as FAILED

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Invalid request parameters |
| NOT_FOUND | 404 | Resource not found |
| ORDER_PROCESSING_ERROR | 500 | Order processing failure |
| DEX_EXECUTION_ERROR | 500 | DEX execution failure |
| DATABASE_ERROR | 500 | Database operation failure |
| QUEUE_ERROR | 500 | Queue operation failure |
| WEBSOCKET_ERROR | 500 | WebSocket operation failure |

---

## Best Practices

### 1. Use WebSocket for Real-time Updates

Instead of polling with GET requests, use WebSocket for instant updates:

```javascript
// ❌ Polling (inefficient)
setInterval(() => {
  fetch(`/api/orders/${orderId}`)
    .then(res => res.json())
    .then(data => console.log(data.status));
}, 1000);

// ✅ WebSocket (efficient)
const ws = new WebSocket(`ws://localhost:3000/api/orders/${orderId}/ws`);
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'status_update') {
    console.log(data.status);
  }
};
```

### 2. Handle WebSocket Reconnection

Implement reconnection logic for network interruptions:

```javascript
let ws;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

function connect() {
  ws = new WebSocket(`ws://localhost:3000/api/orders/${orderId}/ws`);

  ws.onopen = () => {
    reconnectAttempts = 0;
    console.log('Connected');
  };

  ws.onclose = () => {
    if (reconnectAttempts < maxReconnectAttempts) {
      setTimeout(() => {
        reconnectAttempts++;
        connect();
      }, 1000 * reconnectAttempts);
    }
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleUpdate(data);
  };
}

connect();
```

### 3. Validate Input Before Submission

Validate order parameters client-side to avoid 400 errors:

```javascript
function validateOrder(order) {
  if (!['MARKET'].includes(order.type)) {
    throw new Error('Invalid order type');
  }

  if (!['BTC/USDT', 'ETH/USDT', 'BTC/ETH'].includes(order.pair)) {
    throw new Error('Invalid trading pair');
  }

  if (order.amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(order.walletAddress)) {
    throw new Error('Invalid wallet address');
  }
}
```

### 4. Handle Graceful Degradation

If queue is unavailable, the system still creates the order:

```javascript
fetch('/api/orders/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(order)
})
  .then(res => res.json())
  .then(data => {
    if (data.warning) {
      console.warn('Queue unavailable, polling required');
      // Fall back to polling
      pollOrderStatus(data.orderId);
    } else {
      // Use WebSocket
      connectWebSocket(data.orderId);
    }
  });
```

---

## Examples

See [postman/](../postman/) folder for complete Postman collection with examples for all endpoints.
