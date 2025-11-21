import WebSocket from 'ws';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const WS_URL = process.env.WS_URL || 'localhost:3000';

interface OrderResponse {
  orderId: string;
  status: string;
  message: string;
  websocket?: string;
}

interface StatusUpdate {
  type: string;
  orderId?: string;
  status?: string;
  timestamp?: string;
  metadata?: any;
  clientId?: string;
  subscribedTo?: string;
  message?: string;
}

async function executeOrder(pair: string, amount: number): Promise<OrderResponse> {
  console.log(`\n📤 Submitting ${pair} order for ${amount} units...`);

  const response = await fetch(`${BASE_URL}/api/orders/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'MARKET',
      pair,
      amount,
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to execute order: ${error.message}`);
  }

  const data: OrderResponse = await response.json();
  console.log(`✅ Order created: ${data.orderId}`);
  console.log(`   Status: ${data.status}`);

  return data;
}

function monitorOrderViaWebSocket(orderId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n🔌 Connecting to WebSocket for order ${orderId}...`);

    const ws = new WebSocket(`ws://${WS_URL}/api/orders/${orderId}/ws`);
    const startTime = Date.now();

    ws.on('open', () => {
      console.log('✅ WebSocket connected');
    });

    ws.on('message', (data: WebSocket.Data) => {
      const update: StatusUpdate = JSON.parse(data.toString());

      if (update.type === 'connected') {
        console.log(`📡 Subscribed to order updates (Client ID: ${update.clientId})`);
      } else if (update.type === 'status_update') {
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(`\n⏱️  [${elapsedTime}s] Status: ${update.status}`);

        if (update.metadata) {
          if (update.metadata.message) {
            console.log(`   📝 ${update.metadata.message}`);
          }
          if (update.metadata.dex) {
            console.log(`   🏦 DEX: ${update.metadata.dex}`);
          }
          if (update.metadata.reason) {
            console.log(`   💡 Reason: ${update.metadata.reason}`);
          }
          if (update.metadata.txHash) {
            console.log(`   🔗 Transaction Hash: ${update.metadata.txHash}`);
          }
          if (update.metadata.executedPrice) {
            console.log(`   💰 Executed Price: $${update.metadata.executedPrice}`);
            console.log(`   💵 Received Amount: $${update.metadata.receivedAmount}`);
            console.log(`   💸 Fee: $${update.metadata.fee}`);
          }
          if (update.metadata.error) {
            console.log(`   ❌ Error: ${update.metadata.error}`);
          }
        }

        // Close WebSocket when order reaches final state
        if (update.status === 'CONFIRMED' || update.status === 'FAILED') {
          console.log(`\n🏁 Order ${update.status} in ${elapsedTime}s`);
          ws.close();
          resolve();
        }
      } else if (update.type === 'error') {
        console.error(`❌ WebSocket Error: ${update.message}`);
        ws.close();
        reject(new Error(update.message));
      }
    });

    ws.on('error', (error) => {
      console.error('❌ WebSocket Error:', error.message);
      reject(error);
    });

    ws.on('close', () => {
      console.log('🔌 WebSocket disconnected');
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log('⏰ Timeout: Order processing took too long');
        ws.close();
        reject(new Error('Timeout waiting for order completion'));
      }
    }, 30000);
  });
}

async function checkOrderStatus(orderId: string): Promise<void> {
  console.log(`\n📊 Fetching final order details...`);

  const response = await fetch(`${BASE_URL}/api/orders/${orderId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch order details');
  }

  const order = await response.json();

  console.log(`\n📋 Final Order Details:`);
  console.log(`   Order ID: ${order._id}`);
  console.log(`   Pair: ${order.pair}`);
  console.log(`   Amount: ${order.amount}`);
  console.log(`   Status: ${order.status}`);
  console.log(`   DEX Used: ${order.dexUsed || 'N/A'}`);
  console.log(`   Executed Price: $${order.executedPrice || 'N/A'}`);
  console.log(`   Received Amount: $${order.receivedAmount || 'N/A'}`);
  console.log(`   Fee: $${order.fee || 'N/A'}`);
  console.log(`   TX Hash: ${order.txHash || 'N/A'}`);

  console.log(`\n📜 Status History:`);
  order.statusHistory.forEach((entry: any, index: number) => {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    console.log(`   ${index + 1}. ${entry.status} (${timestamp})`);
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 DEX Order Engine - Single Order Test');
  console.log('='.repeat(60));

  try {
    // Execute a single order
    const order = await executeOrder('BTC/USDT', 0.5);

    // Monitor via WebSocket
    await monitorOrderViaWebSocket(order.orderId);

    // Fetch final order details
    await checkOrderStatus(order.orderId);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed successfully!');
    console.log('='.repeat(60) + '\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
