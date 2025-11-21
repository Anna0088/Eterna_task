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
}

interface PairTestConfig {
  pair: string;
  amount: number;
  description: string;
  emoji: string;
}

const PAIR_CONFIGS: PairTestConfig[] = [
  {
    pair: 'BTC/USDT',
    amount: 0.5,
    description: 'Bitcoin to USDT',
    emoji: '🟡',
  },
  {
    pair: 'ETH/USDT',
    amount: 10,
    description: 'Ethereum to USDT',
    emoji: '🔵',
  },
  {
    pair: 'BTC/ETH',
    amount: 0.25,
    description: 'Bitcoin to Ethereum',
    emoji: '🟣',
  },
];

async function executeOrder(config: PairTestConfig): Promise<OrderResponse> {
  const response = await fetch(`${BASE_URL}/api/orders/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'MARKET',
      pair: config.pair,
      amount: config.amount,
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to execute order: ${error.message}`);
  }

  return await response.json();
}

function monitorOrder(
  orderId: string,
  config: PairTestConfig
): Promise<{
  config: PairTestConfig;
  orderId: string;
  status: string;
  duration: number;
  dex?: string;
  executedPrice?: number;
  receivedAmount?: number;
  fee?: number;
  error?: string;
}> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${WS_URL}/api/orders/${orderId}/ws`);
    const startTime = Date.now();
    let finalStatus = '';
    let dexUsed: string | undefined;
    let executedPrice: number | undefined;
    let receivedAmount: number | undefined;
    let fee: number | undefined;
    let errorMessage: string | undefined;

    ws.on('open', () => {
      console.log(`${config.emoji} ${config.pair}: Connected to WebSocket`);
    });

    ws.on('message', (data: WebSocket.Data) => {
      const update: StatusUpdate = JSON.parse(data.toString());

      if (update.type === 'status_update') {
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log(`${config.emoji} ${config.pair} [${elapsedTime}s]: ${update.status}`);

        if (update.metadata) {
          if (update.metadata.dex) {
            dexUsed = update.metadata.dex;
            console.log(`   └─ Selected DEX: ${update.metadata.dex}`);
            if (update.metadata.reason) {
              console.log(`   └─ Reason: ${update.metadata.reason}`);
            }
          }

          if (update.metadata.executedPrice) {
            executedPrice = update.metadata.executedPrice;
            receivedAmount = update.metadata.receivedAmount;
            fee = update.metadata.fee;
          }

          if (update.metadata.error) {
            errorMessage = update.metadata.error;
          }
        }

        if (update.status === 'CONFIRMED' || update.status === 'FAILED') {
          finalStatus = update.status;
          const duration = parseFloat(elapsedTime);

          ws.close();

          resolve({
            config,
            orderId,
            status: finalStatus,
            duration,
            dex: dexUsed,
            executedPrice,
            receivedAmount,
            fee,
            error: errorMessage,
          });
        }
      }
    });

    ws.on('error', (error) => {
      console.error(`${config.emoji} ${config.pair}: WebSocket Error - ${error.message}`);
      reject(error);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
        reject(new Error(`${config.pair} order timed out`));
      }
    }, 30000);
  });
}

async function testAllPairs() {
  console.log('='.repeat(70));
  console.log('💱 DEX Order Engine - All Trading Pairs Test');
  console.log('='.repeat(70));
  console.log('');

  console.log('Testing all supported trading pairs:');
  PAIR_CONFIGS.forEach((config) => {
    console.log(`   ${config.emoji} ${config.pair}: ${config.amount} units (${config.description})`);
  });

  console.log('\n' + '='.repeat(70));
  console.log('');

  const testStartTime = Date.now();

  try {
    // Execute all orders
    console.log('📤 Submitting orders for all pairs...\n');

    const orderPromises = PAIR_CONFIGS.map(async (config) => {
      console.log(`${config.emoji} Submitting ${config.pair} order...`);
      const response = await executeOrder(config);
      console.log(`   ✅ Order ID: ${response.orderId}\n`);

      return {
        config,
        orderId: response.orderId,
      };
    });

    const orders = await Promise.all(orderPromises);

    console.log('='.repeat(70));
    console.log('📡 Monitoring all orders via WebSocket...\n');

    // Monitor all orders
    const monitorPromises = orders.map((order) => monitorOrder(order.orderId, order.config));

    const results = await Promise.all(monitorPromises);

    const testEndTime = Date.now();
    const totalDuration = ((testEndTime - testStartTime) / 1000).toFixed(2);

    // Display results
    console.log('\n' + '='.repeat(70));
    console.log('📊 TEST RESULTS');
    console.log('='.repeat(70));
    console.log('');

    results.forEach((result, index) => {
      const statusIcon = result.status === 'CONFIRMED' ? '✅' : '❌';

      console.log(`${result.config.emoji} ${result.config.pair}:`);
      console.log(`   Status: ${statusIcon} ${result.status}`);
      console.log(`   Amount: ${result.config.amount}`);
      console.log(`   Duration: ${result.duration}s`);

      if (result.dex) {
        console.log(`   DEX Used: ${result.dex}`);
      }

      if (result.executedPrice) {
        console.log(`   Executed Price: $${result.executedPrice.toFixed(2)}`);
        console.log(`   Received Amount: $${result.receivedAmount!.toFixed(2)}`);
        console.log(`   Fee: $${result.fee!.toFixed(2)}`);
        console.log(`   Fee Percentage: ${((result.fee! / result.receivedAmount!) * 100).toFixed(2)}%`);
      }

      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }

      console.log('');
    });

    // Statistics
    console.log('-'.repeat(70));
    console.log('📈 STATISTICS:');
    console.log('');

    const confirmedCount = results.filter((r) => r.status === 'CONFIRMED').length;
    const failedCount = results.filter((r) => r.status === 'FAILED').length;
    const avgDuration = (
      results.reduce((sum, r) => sum + r.duration, 0) / results.length
    ).toFixed(2);

    console.log(`   Total Pairs Tested: ${PAIR_CONFIGS.length}`);
    console.log(`   Confirmed: ${confirmedCount}`);
    console.log(`   Failed: ${failedCount}`);
    console.log(`   Success Rate: ${((confirmedCount / PAIR_CONFIGS.length) * 100).toFixed(1)}%`);
    console.log(`   Average Execution Time: ${avgDuration}s`);
    console.log(`   Total Test Duration: ${totalDuration}s`);
    console.log('');

    // DEX usage statistics
    const dexStats: Record<string, number> = {};
    results.forEach((result) => {
      if (result.dex) {
        dexStats[result.dex] = (dexStats[result.dex] || 0) + 1;
      }
    });

    if (Object.keys(dexStats).length > 0) {
      console.log('🏦 DEX USAGE:');
      Object.entries(dexStats).forEach(([dex, count]) => {
        const percentage = ((count / confirmedCount) * 100).toFixed(1);
        console.log(`   ${dex}: ${count} orders (${percentage}%)`);
      });
      console.log('');
    }

    // Fetch order details from API
    console.log('-'.repeat(70));
    console.log('📋 FETCHING FINAL ORDER DETAILS FROM API...\n');

    for (const result of results) {
      try {
        const response = await fetch(`${BASE_URL}/api/orders/${result.orderId}`);
        const order = await response.json();

        console.log(`${result.config.emoji} ${result.config.pair} (${result.orderId.slice(0, 8)}...):`);
        console.log(`   Status History: ${order.statusHistory.length} state changes`);
        console.log(
          `   Created: ${new Date(order.createdAt).toLocaleTimeString()}`
        );
        console.log(
          `   Updated: ${new Date(order.updatedAt).toLocaleTimeString()}`
        );
        console.log('');
      } catch (error) {
        console.log(`${result.config.emoji} ${result.config.pair}: Could not fetch details\n`);
      }
    }

    console.log('='.repeat(70));

    if (confirmedCount === PAIR_CONFIGS.length) {
      console.log('✅ All trading pairs tested successfully!');
    } else {
      console.log(`⚠️  ${failedCount} out of ${PAIR_CONFIGS.length} pairs failed`);
    }

    console.log('='.repeat(70));
    console.log('');

    process.exit(confirmedCount === PAIR_CONFIGS.length ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testAllPairs();
