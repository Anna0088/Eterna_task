import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { config } from '../config';
import { OrderService } from '../services/OrderService';
import { OrderJobData } from './orderQueue';
import { OrderType } from '../types';

const orderService = new OrderService();

// Create the worker
export const orderWorker = new Worker<OrderJobData>(
  'orders',
  async (job: Job<OrderJobData>) => {
    const { orderId, order } = job.data;

    console.log(`\n🔨 Processing ${order.type} order ${orderId} (${order.pair}) - Attempt ${job.attemptsMade + 1}`);

    try {
      // Route based on order type
      if (order.type === OrderType.LIMIT) {
        // LIMIT orders are already in WAITING_FOR_PRICE status
        // They will be monitored by PriceMonitorService
        // This job just confirms the order was created
        console.log(`📊 LIMIT order ${orderId} registered for price monitoring (target: ${order.limitPrice})`);

        await job.updateProgress(100);

        return {
          orderId,
          status: order.status,
          message: 'LIMIT order registered for price monitoring',
        };
      } else {
        // MARKET orders (and other types) - process immediately
        const result = await orderService.processOrder(orderId);

        // Update job progress
        await job.updateProgress(100);

        return {
          orderId,
          status: result.status,
          txHash: result.txHash,
          dexUsed: result.dexUsed,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Worker error for order ${orderId}:`, errorMessage);

      // Check if we should retry
      if (job.attemptsMade < config.orderProcessing.maxRetryAttempts - 1) {
        console.log(`🔄 Will retry order ${orderId} (attempt ${job.attemptsMade + 1}/${config.orderProcessing.maxRetryAttempts})`);
      } else {
        console.log(`⛔ Max retries reached for order ${orderId}`);
      }

      throw error; // Re-throw to trigger BullMQ retry logic
    }
  },
  {
    connection: createRedisConnection(),
    concurrency: config.orderProcessing.maxConcurrent,
    limiter: {
      max: config.orderProcessing.ordersPerMinute,
      duration: 60000, // 1 minute in milliseconds
    },
    autorun: false, // Don't start automatically, we'll start it manually
  }
);

// Worker event handlers
orderWorker.on('ready', () => {
  console.log('🚀 Order worker is ready and waiting for jobs');
});

orderWorker.on('active', (job: Job) => {
  console.log(`⚡ Worker started processing job ${job.id}`);
});

orderWorker.on('completed', (job: Job, result) => {
  console.log(`✅ Worker completed job ${job.id}:`, result);
});

orderWorker.on('failed', (job: Job | undefined, error: Error) => {
  if (job) {
    console.error(`❌ Worker failed job ${job.id}:`, error.message);
  } else {
    console.error(`❌ Worker failed:`, error.message);
  }
});

orderWorker.on('error', (error: Error) => {
  console.error('❌ Worker error:', error);
});

orderWorker.on('stalled', (jobId: string) => {
  console.warn(`⚠️ Job ${jobId} stalled`);
});

// Start the worker
export const startWorker = async () => {
  console.log('🔧 Starting order worker...');
  console.log(`   Concurrency: ${config.orderProcessing.maxConcurrent} jobs`);
  console.log(`   Rate limit: ${config.orderProcessing.ordersPerMinute} orders/minute`);
  console.log(`   Max retries: ${config.orderProcessing.maxRetryAttempts} attempts`);

  // Don't await - let it run in background
  orderWorker.run();

  // Wait a bit for the worker to initialize
  await new Promise(resolve => setTimeout(resolve, 100));
};

// Stop the worker
export const stopWorker = async () => {
  console.log('Stopping order worker...');
  await orderWorker.close();
};

// Graceful shutdown
process.on('SIGINT', async () => {
  await stopWorker();
});

process.on('SIGTERM', async () => {
  await stopWorker();
});
