import WebSocket from 'ws';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const WS_URL = process.env.WS_URL || 'localhost:3000';

interface OrderResponse {
  orderId: string;
  status: string;
  message: string;
  websocket?: string;
  warning?: string;
}

interface StatusUpdate {
  type: string;
  orderId?: string;
  status?: string;
  timestamp?: string;
  metadata?: any;
}

interface OrderResult {
  orderId: string;
  pair: string;
  amount: number;
  submittedAt: number;
  status: string;
  duration?: number;
  error?: string;
}

const TRADING_PAIRS = ['BTC/USDT', 'ETH/USDT', 'BTC/ETH'];

function getRandomPair(): string {
  return TRADING_PAIRS[Math.floor(Math.random() * TRADING_PAIRS.length)];
}

function getRandomAmount(pair: string): number {
  if (pair === 'BTC/USDT' || pair === 'BTC/ETH') {
    return Math.random() * 0.5 + 0.1; // 0.1 to 0.6 BTC
  } else {
    return Math.random() * 10 + 1; // 1 to 11 ETH
  }
}

async function executeOrder(pair: string, amount: number): Promise<OrderResponse> {
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

  return await response.json();
}

function monitorOrder(orderId: string, submittedAt: number): Promise<OrderResult> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://${WS_URL}/api/orders/${orderId}/ws`);
    let finalStatus = 'TIMEOUT';
    const startTime = Date.now();

    ws.on('message', (data: WebSocket.Data) => {
      const update: StatusUpdate = JSON.parse(data.toString());

      if (update.type === 'status_update') {
        if (update.status === 'CONFIRMED' || update.status === 'FAILED') {
          finalStatus = update.status;
          ws.close();
        }
      }
    });

    ws.on('close', () => {
      const duration = (Date.now() - startTime) / 1000;
      resolve({
        orderId,
        pair: '',
        amount: 0,
        submittedAt,
        status: finalStatus,
        duration,
      });
    });

    ws.on('error', () => {
      ws.close();
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    }, 30000);
  });
}

async function stressTest(totalOrders: number, batchSize: number = 10) {
  console.log('='.repeat(70));
  console.log(`⚡ DEX Order Engine - Stress Test`);
  console.log('='.repeat(70));
  console.log(`   Total Orders: ${totalOrders}`);
  console.log(`   Batch Size: ${batchSize}`);
  console.log(`   Expected Queue Rate Limit: 100 orders/minute`);
  console.log(`   Expected Concurrency: 10 simultaneous orders`);
  console.log('='.repeat(70));
  console.log('');

  const allResults: OrderResult[] = [];
  const testStartTime = Date.now();
  let submitted = 0;
  let confirmed = 0;
  let failed = 0;
  let errors = 0;

  const updateProgress = () => {
    const elapsed = ((Date.now() - testStartTime) / 1000).toFixed(1);
    process.stdout.write(
      `\r📊 Progress: ${submitted}/${totalOrders} submitted | ` +
        `✅ ${confirmed} confirmed | ❌ ${failed} failed | ⚠️  ${errors} errors | ⏱️  ${elapsed}s`
    );
  };

  try {
    // Submit orders in batches
    for (let i = 0; i < totalOrders; i += batchSize) {
      const currentBatchSize = Math.min(batchSize, totalOrders - i);
      const batchPromises: Promise<void>[] = [];

      for (let j = 0; j < currentBatchSize; j++) {
        const pair = getRandomPair();
        const amount = parseFloat(getRandomAmount(pair).toFixed(4));

        const promise = (async () => {
          try {
            const submittedAt = Date.now();
            const response = await executeOrder(pair, amount);

            submitted++;
            updateProgress();

            // Monitor order
            const result = await monitorOrder(response.orderId, submittedAt);
            result.pair = pair;
            result.amount = amount;

            if (result.status === 'CONFIRMED') {
              confirmed++;
            } else if (result.status === 'FAILED') {
              failed++;
            }

            allResults.push(result);
            updateProgress();
          } catch (error) {
            errors++;
            submitted++;
            allResults.push({
              orderId: 'N/A',
              pair,
              amount,
              submittedAt: Date.now(),
              status: 'ERROR',
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            updateProgress();
          }
        })();

        batchPromises.push(promise);
      }

      // Wait for current batch to complete before submitting next batch
      await Promise.all(batchPromises);

      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < totalOrders) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Wait a bit more for any pending operations
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const testEndTime = Date.now();
    const totalDuration = ((testEndTime - testStartTime) / 1000).toFixed(2);

    console.log('\n\n' + '='.repeat(70));
    console.log('📊 STRESS TEST RESULTS');
    console.log('='.repeat(70));
    console.log('');

    // Overall statistics
    console.log('📈 OVERALL STATISTICS:');
    console.log(`   Total Orders Submitted: ${submitted}`);
    console.log(`   Confirmed: ${confirmed} (${((confirmed / submitted) * 100).toFixed(1)}%)`);
    console.log(`   Failed: ${failed} (${((failed / submitted) * 100).toFixed(1)}%)`);
    console.log(`   Errors: ${errors} (${((errors / submitted) * 100).toFixed(1)}%)`);
    console.log(`   Total Duration: ${totalDuration}s`);
    console.log(`   Throughput: ${(submitted / parseFloat(totalDuration)).toFixed(2)} orders/second`);
    console.log('');

    // Execution time statistics
    const successfulResults = allResults.filter((r) => r.duration && r.status === 'CONFIRMED');
    if (successfulResults.length > 0) {
      const durations = successfulResults.map((r) => r.duration!);
      const avgDuration = (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2);
      const minDuration = Math.min(...durations).toFixed(2);
      const maxDuration = Math.max(...durations).toFixed(2);

      console.log('⏱️  EXECUTION TIME STATISTICS:');
      console.log(`   Average: ${avgDuration}s`);
      console.log(`   Minimum: ${minDuration}s`);
      console.log(`   Maximum: ${maxDuration}s`);
      console.log('');
    }

    // Pair distribution
    const pairStats: Record<string, { total: number; confirmed: number }> = {};
    allResults.forEach((result) => {
      if (!pairStats[result.pair]) {
        pairStats[result.pair] = { total: 0, confirmed: 0 };
      }
      pairStats[result.pair].total++;
      if (result.status === 'CONFIRMED') {
        pairStats[result.pair].confirmed++;
      }
    });

    console.log('💱 TRADING PAIR DISTRIBUTION:');
    Object.entries(pairStats).forEach(([pair, stats]) => {
      const successRate = ((stats.confirmed / stats.total) * 100).toFixed(1);
      console.log(`   ${pair}: ${stats.total} orders (${stats.confirmed} confirmed, ${successRate}% success)`);
    });
    console.log('');

    // System health check
    console.log('🏥 SYSTEM HEALTH CHECK:');
    const healthResponse = await fetch(`${BASE_URL}/health`);
    const health = await healthResponse.json();

    console.log(`   Database: ${health.database}`);
    console.log(`   Redis: ${health.redis}`);
    console.log(`   Queue Status:`);
    console.log(`     - Waiting: ${health.queue.waiting}`);
    console.log(`     - Active: ${health.queue.active}`);
    console.log(`     - Completed: ${health.queue.completed}`);
    console.log(`     - Failed: ${health.queue.failed}`);
    console.log(`     - Total Processed: ${health.queue.total}`);
    console.log('');

    console.log('='.repeat(70));

    const overallSuccess = (confirmed / submitted) >= 0.8; // 80% success threshold
    if (overallSuccess) {
      console.log('✅ Stress test completed successfully!');
    } else {
      console.log('⚠️  Stress test completed with warnings (low success rate)');
    }

    console.log('='.repeat(70));
    console.log('');

    process.exit(overallSuccess ? 0 : 1);
  } catch (error) {
    console.error('\n\n❌ Stress test failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// Get parameters from command line
const totalOrders = parseInt(process.argv[2]) || 20;
const batchSize = parseInt(process.argv[3]) || 10;

if (totalOrders < 1 || totalOrders > 100) {
  console.error('❌ Total orders must be between 1 and 100');
  process.exit(1);
}

if (batchSize < 1 || batchSize > 20) {
  console.error('❌ Batch size must be between 1 and 20');
  process.exit(1);
}

stressTest(totalOrders, batchSize);
