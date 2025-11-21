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

interface OrderConfig {
  pair: string;
  amount: number;
  color: string;
}

const ORDERS: OrderConfig[] = [
  { pair: 'BTC/USDT', amount: 0.5, color: '🟡' },
  { pair: 'ETH/USDT', amount: 10, color: '🔵' },
  { pair: 'BTC/ETH', amount: 0.25, color: '🟣' },
  { pair: 'BTC/USDT', amount: 1.0, color: '🟢' },
  { pair: 'ETH/USDT', amount: 5, color: '🔴' },
];

async function executeOrder(orderConfig: OrderConfig): Promise<OrderResponse> {
  const response = await fetch(`${BASE_URL}/api/orders/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'MARKET',
      pair: orderConfig.pair,
      amount: orderConfig.amount,
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to execute order: ${error.message}`);
  }

  return await response.json();
}

function monitorOrder(orderId: string, config: OrderConfig, orderNum: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${WS_URL}/api/orders/${orderId}/ws`);
    const startTime = Date.now();
    let finalStatus = '';
    let executionDetails: any = null;

    ws.on('open', () => {
      console.log(`${config.color} Order #${orderNum} (${orderId.slice(0, 8)}...): WebSocket connected`);
    });

    ws.on('message', (data: WebSocket.Data) => {
      const update: StatusUpdate = JSON.parse(data.toString());

      if (update.type === 'status_update') {
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(`${config.color} Order #${orderNum} [${elapsedTime}s]: ${update.status}`);

        if (update.metadata) {
          if (update.metadata.dex) {
            console.log(`   └─ DEX: ${update.metadata.dex} | Reason: ${update.metadata.reason || 'N/A'}`);
          }
          if (update.metadata.executedPrice) {
            executionDetails = update.metadata;
          }
        }

        if (update.status === 'CONFIRMED' || update.status === 'FAILED') {
          finalStatus = update.status;
          ws.close();
          resolve({
            orderNum,
            orderId,
            config,
            status: finalStatus,
            duration: parseFloat(elapsedTime),
            details: executionDetails,
          });
        }
      }
    });

    ws.on('error', (error) => {
      console.error(`${config.color} Order #${orderNum}: WebSocket Error - ${error.message}`);
      reject(error);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
        reject(new Error(`Order #${orderNum} timed out`));
      }
    }, 30000);
  });
}

async function runConcurrentTest(numOrders: number = 5) {
  console.log('='.repeat(70));
  console.log(`🚀 DEX Order Engine - Concurrent Orders Test (${numOrders} orders)`);
  console.log('='.repeat(70));
  console.log('');

  const ordersToTest = ORDERS.slice(0, numOrders);
  const allStartTime = Date.now();

  try {
    // Step 1: Submit all orders concurrently
    console.log('📤 Submitting orders concurrently...\n');

    const submitPromises = ordersToTest.map(async (config, index) => {
      const orderNum = index + 1;
      console.log(`${config.color} Submitting Order #${orderNum}: ${config.pair} (${config.amount} units)`);

      const response = await executeOrder(config);

      return {
        orderNum,
        orderId: response.orderId,
        config,
      };
    });

    const submittedOrders = await Promise.all(submitPromises);

    console.log(`\n✅ All ${numOrders} orders submitted successfully!\n`);
    console.log('-'.repeat(70));
    console.log('📡 Monitoring order execution via WebSocket...\n');

    // Step 2: Monitor all orders concurrently
    const monitorPromises = submittedOrders.map((order) =>
      monitorOrder(order.orderId, order.config, order.orderNum)
    );

    const results = await Promise.all(monitorPromises);

    const allEndTime = Date.now();
    const totalDuration = ((allEndTime - allStartTime) / 1000).toFixed(2);

    // Step 3: Display summary
    console.log('\n' + '='.repeat(70));
    console.log('📊 EXECUTION SUMMARY');
    console.log('='.repeat(70));
    console.log('');

    results.forEach((result) => {
      const statusIcon = result.status === 'CONFIRMED' ? '✅' : '❌';

      console.log(`${result.config.color} Order #${result.orderNum}:`);
      console.log(`   Pair: ${result.config.pair}`);
      console.log(`   Amount: ${result.config.amount}`);
      console.log(`   Status: ${statusIcon} ${result.status}`);
      console.log(`   Duration: ${result.duration}s`);

      if (result.details) {
        console.log(`   Executed Price: $${result.details.executedPrice}`);
        console.log(`   Received Amount: $${result.details.receivedAmount}`);
        console.log(`   Fee: $${result.details.fee}`);
      }

      console.log('');
    });

    // Statistics
    const confirmedCount = results.filter((r) => r.status === 'CONFIRMED').length;
    const failedCount = results.filter((r) => r.status === 'FAILED').length;
    const avgDuration = (
      results.reduce((sum, r) => sum + r.duration, 0) / results.length
    ).toFixed(2);

    console.log('-'.repeat(70));
    console.log(`📈 STATISTICS:`);
    console.log(`   Total Orders: ${numOrders}`);
    console.log(`   Confirmed: ${confirmedCount}`);
    console.log(`   Failed: ${failedCount}`);
    console.log(`   Success Rate: ${((confirmedCount / numOrders) * 100).toFixed(1)}%`);
    console.log(`   Average Execution Time: ${avgDuration}s`);
    console.log(`   Total Test Duration: ${totalDuration}s`);
    console.log('='.repeat(70));
    console.log('');

    console.log('✅ Concurrent test completed successfully!\n');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Get number of orders from command line argument (default: 5)
const numOrders = parseInt(process.argv[2]) || 5;

if (numOrders < 1 || numOrders > 10) {
  console.error('❌ Number of orders must be between 1 and 10');
  process.exit(1);
}

runConcurrentTest(numOrders);
