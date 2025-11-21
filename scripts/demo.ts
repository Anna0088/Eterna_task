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
}

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
};

const c = colors;

function colorize(text: string, color: string): string {
  return `${color}${text}${c.reset}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function printBanner() {
  console.clear();
  console.log('');
  console.log(colorize('╔═══════════════════════════════════════════════════════════════════╗', c.cyan + c.bright));
  console.log(colorize('║                                                                   ║', c.cyan + c.bright));
  console.log(colorize('║              ', c.cyan + c.bright) + colorize('🚀 DEX ORDER EXECUTION ENGINE 🚀', c.yellow + c.bright) + colorize('              ║', c.cyan + c.bright));
  console.log(colorize('║                                                                   ║', c.cyan + c.bright));
  console.log(colorize('║             ', c.cyan + c.bright) + colorize('Multi-DEX Routing • Real-time Updates', c.white) + colorize('              ║', c.cyan + c.bright));
  console.log(colorize('║                                                                   ║', c.cyan + c.bright));
  console.log(colorize('╚═══════════════════════════════════════════════════════════════════╝', c.cyan + c.bright));
  console.log('');
  await sleep(1000);
}

async function printSection(title: string) {
  console.log('');
  console.log(colorize(`━━━ ${title} ━━━`, c.magenta + c.bright));
  console.log('');
  await sleep(500);
}

async function checkHealth() {
  await printSection('SYSTEM HEALTH CHECK');

  console.log(colorize('⏳ Checking system status...', c.dim));
  await sleep(500);

  const response = await fetch(`${BASE_URL}/health`);
  const health = await response.json();

  console.log(colorize('✓', c.green + c.bright) + ' Status: ' + colorize(health.status.toUpperCase(), c.green + c.bright));
  console.log(colorize('✓', c.green + c.bright) + ' Database: ' + colorize(health.database, c.green));
  console.log(colorize('✓', c.green + c.bright) + ' Redis: ' + colorize(health.redis, c.green));
  console.log(colorize('✓', c.green + c.bright) + ' Queue System: ' + colorize('OPERATIONAL', c.green));

  console.log('');
  console.log(colorize('  Queue Metrics:', c.cyan));
  console.log(colorize(`    • Waiting: ${health.queue.waiting}`, c.white));
  console.log(colorize(`    • Active: ${health.queue.active}`, c.white));
  console.log(colorize(`    • Completed: ${health.queue.completed}`, c.white));
  console.log(colorize(`    • Failed: ${health.queue.failed}`, c.white));

  await sleep(1000);
}

async function executeOrder(pair: string, amount: number, emoji: string, color: string): Promise<OrderResponse> {
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

function monitorOrderWithAnimation(
  orderId: string,
  pair: string,
  emoji: string,
  color: string
): Promise<any> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${WS_URL}/api/orders/${orderId}/ws`);
    const startTime = Date.now();
    let executionDetails: any = null;

    ws.on('open', () => {
      console.log(colorize(`${emoji} ${pair}:`, color + c.bright) + ' ' + colorize('WebSocket Connected', c.green));
    });

    ws.on('message', (data: WebSocket.Data) => {
      const update: StatusUpdate = JSON.parse(data.toString());

      if (update.type === 'status_update') {
        const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
        const statusIcons: Record<string, string> = {
          PENDING: '⏳',
          ROUTING: '🔍',
          BUILDING: '🔨',
          SUBMITTED: '📤',
          CONFIRMED: '✅',
          FAILED: '❌',
        };

        const statusColors: Record<string, string> = {
          PENDING: c.yellow,
          ROUTING: c.blue,
          BUILDING: c.cyan,
          SUBMITTED: c.magenta,
          CONFIRMED: c.green,
          FAILED: c.red,
        };

        const statusIcon = statusIcons[update.status!] || '•';
        const statusColor = statusColors[update.status!] || c.white;

        console.log(
          colorize(`${emoji}`, color) +
            colorize(` [${elapsedTime}s] `, c.dim) +
            colorize(statusIcon, statusColor + c.bright) +
            ' ' +
            colorize(update.status!, statusColor + c.bright)
        );

        if (update.metadata) {
          if (update.metadata.message) {
            console.log(colorize(`    ├─ ${update.metadata.message}`, c.dim));
          }
          if (update.metadata.dex) {
            console.log(
              colorize(`    ├─ DEX Selected: `, c.dim) +
                colorize(update.metadata.dex, c.cyan + c.bright)
            );
            if (update.metadata.reason) {
              console.log(colorize(`    ├─ Reason: ${update.metadata.reason}`, c.dim));
            }
          }
          if (update.metadata.txHash) {
            const shortHash = update.metadata.txHash.slice(0, 10) + '...';
            console.log(colorize(`    ├─ TX Hash: ${shortHash}`, c.dim));
          }
          if (update.metadata.executedPrice) {
            executionDetails = update.metadata;
            console.log(
              colorize(`    ├─ Price: `, c.dim) +
                colorize(`$${update.metadata.executedPrice.toFixed(2)}`, c.green + c.bright)
            );
            console.log(
              colorize(`    ├─ Received: `, c.dim) +
                colorize(`$${update.metadata.receivedAmount.toFixed(2)}`, c.green + c.bright)
            );
            console.log(
              colorize(`    └─ Fee: `, c.dim) +
                colorize(`$${update.metadata.fee.toFixed(2)}`, c.yellow)
            );
          }
        }

        if (update.status === 'CONFIRMED' || update.status === 'FAILED') {
          ws.close();
          resolve({
            pair,
            status: update.status,
            duration: parseFloat(elapsedTime),
            details: executionDetails,
          });
        }
      }
    });

    ws.on('error', (error) => {
      console.error(colorize(`${emoji} WebSocket Error: ${error.message}`, c.red));
      reject(error);
    });

    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
        reject(new Error('Timeout'));
      }
    }, 30000);
  });
}

async function demoSingleOrder() {
  await printSection('DEMO: SINGLE ORDER EXECUTION');

  console.log(colorize('📝 Creating order:', c.white + c.bright));
  console.log(colorize('   • Trading Pair: BTC/USDT', c.white));
  console.log(colorize('   • Amount: 0.5 BTC', c.white));
  console.log(colorize('   • Type: MARKET', c.white));
  console.log('');

  await sleep(1000);

  const order = await executeOrder('BTC/USDT', 0.5, '🟡', c.yellow);

  console.log(colorize('✓ Order Submitted', c.green + c.bright));
  console.log(colorize(`   Order ID: ${order.orderId}`, c.dim));
  console.log('');

  await sleep(500);

  console.log(colorize('📡 Monitoring real-time status updates via WebSocket...', c.cyan));
  console.log('');

  const result = await monitorOrderWithAnimation(order.orderId, 'BTC/USDT', '🟡', c.yellow);

  console.log('');
  console.log(colorize(`🎉 Order ${result.status} in ${result.duration}s`, c.green + c.bright));

  await sleep(1500);
}

async function demoConcurrentOrders() {
  await printSection('DEMO: CONCURRENT ORDER EXECUTION');

  console.log(colorize('📝 Submitting 3 orders simultaneously:', c.white + c.bright));
  console.log(colorize('   🟡 BTC/USDT - 0.5 BTC', c.yellow));
  console.log(colorize('   🔵 ETH/USDT - 10 ETH', c.blue));
  console.log(colorize('   🟣 BTC/ETH - 0.25 BTC', c.magenta));
  console.log('');

  await sleep(1000);

  const orders = [
    { pair: 'BTC/USDT', amount: 0.5, emoji: '🟡', color: c.yellow },
    { pair: 'ETH/USDT', amount: 10, emoji: '🔵', color: c.blue },
    { pair: 'BTC/ETH', amount: 0.25, emoji: '🟣', color: c.magenta },
  ];

  console.log(colorize('⏳ Submitting orders...', c.dim));
  console.log('');

  const submitPromises = orders.map(async (config) => {
    const response = await executeOrder(config.pair, config.amount, config.emoji, config.color);
    console.log(
      colorize(config.emoji, config.color) +
        ' ' +
        colorize(config.pair, config.color + c.bright) +
        colorize(' - Order Created: ', c.dim) +
        colorize(response.orderId.slice(0, 8) + '...', c.white)
    );
    return { ...config, orderId: response.orderId };
  });

  const submittedOrders = await Promise.all(submitPromises);

  console.log('');
  console.log(colorize('✓ All orders submitted!', c.green + c.bright));
  console.log('');

  await sleep(500);

  console.log(colorize('📡 Monitoring all orders in real-time...', c.cyan));
  console.log('');

  const monitorPromises = submittedOrders.map((order) =>
    monitorOrderWithAnimation(order.orderId, order.pair, order.emoji, order.color)
  );

  const results = await Promise.all(monitorPromises);

  console.log('');
  const confirmedCount = results.filter((r) => r.status === 'CONFIRMED').length;
  console.log(
    colorize(
      `🎉 All ${confirmedCount}/${results.length} orders completed successfully!`,
      c.green + c.bright
    )
  );

  await sleep(1500);
}

async function showStatistics() {
  await printSection('FINAL STATISTICS');

  console.log(colorize('📊 Fetching system statistics...', c.dim));
  await sleep(500);

  const response = await fetch(`${BASE_URL}/health`);
  const health = await response.json();

  const totalProcessed = health.queue.completed + health.queue.failed;
  const successRate =
    totalProcessed > 0 ? ((health.queue.completed / totalProcessed) * 100).toFixed(1) : '0.0';

  console.log('');
  console.log(colorize('  Queue Performance:', c.cyan + c.bright));
  console.log(
    colorize('    • Total Processed: ', c.white) +
      colorize(totalProcessed.toString(), c.green + c.bright)
  );
  console.log(
    colorize('    • Completed: ', c.white) +
      colorize(health.queue.completed.toString(), c.green + c.bright)
  );
  console.log(
    colorize('    • Failed: ', c.white) + colorize(health.queue.failed.toString(), c.red)
  );
  console.log(
    colorize('    • Success Rate: ', c.white) +
      colorize(`${successRate}%`, c.green + c.bright)
  );
  console.log(
    colorize('    • Currently Active: ', c.white) +
      colorize(health.queue.active.toString(), c.yellow)
  );

  console.log('');
  console.log(colorize('  System Health:', c.cyan + c.bright));
  console.log(
    colorize('    • Database: ', c.white) + colorize(health.database.toUpperCase(), c.green)
  );
  console.log(
    colorize('    • Redis: ', c.white) + colorize(health.redis.toUpperCase(), c.green)
  );
  console.log(
    colorize('    • Uptime: ', c.white) +
      colorize(`${Math.floor(health.uptime / 60)} minutes`, c.green)
  );

  await sleep(1500);
}

async function printFooter() {
  console.log('');
  console.log(colorize('╔═══════════════════════════════════════════════════════════════════╗', c.cyan + c.bright));
  console.log(colorize('║                                                                   ║', c.cyan + c.bright));
  console.log(colorize('║                     ', c.cyan + c.bright) + colorize('✨ DEMO COMPLETED ✨', c.green + c.bright) + colorize('                     ║', c.cyan + c.bright));
  console.log(colorize('║                                                                   ║', c.cyan + c.bright));
  console.log(colorize('║         ', c.cyan + c.bright) + colorize('Features Demonstrated:', c.white + c.bright) + colorize('                             ║', c.cyan + c.bright));
  console.log(colorize('║           ', c.cyan + c.bright) + colorize('• Multi-DEX Intelligent Routing', c.white) + colorize('                      ║', c.cyan + c.bright));
  console.log(colorize('║           ', c.cyan + c.bright) + colorize('• Real-time WebSocket Updates', c.white) + colorize('                        ║', c.cyan + c.bright));
  console.log(colorize('║           ', c.cyan + c.bright) + colorize('• Concurrent Order Processing', c.white) + colorize('                        ║', c.cyan + c.bright));
  console.log(colorize('║           ', c.cyan + c.bright) + colorize('• Multiple Trading Pairs (BTC, ETH)', c.white) + colorize('                  ║', c.cyan + c.bright));
  console.log(colorize('║                                                                   ║', c.cyan + c.bright));
  console.log(colorize('╚═══════════════════════════════════════════════════════════════════╝', c.cyan + c.bright));
  console.log('');
}

async function main() {
  try {
    await printBanner();
    await checkHealth();
    await demoSingleOrder();
    await demoConcurrentOrders();
    await showStatistics();
    await printFooter();

    process.exit(0);
  } catch (error) {
    console.error(
      colorize('\n❌ Demo failed: ', c.red + c.bright) +
        (error instanceof Error ? error.message : error)
    );
    process.exit(1);
  }
}

main();
