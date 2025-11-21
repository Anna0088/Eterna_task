import { Queue, QueueEvents } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { config } from '../config';
import { Order } from '../types';

export interface OrderJobData {
  orderId: string;
  order: Order;
}

// Create Redis connection for queue
const connection = createRedisConnection();

// Create the order queue
export const orderQueue = new Queue<OrderJobData>('orders', {
  connection,
  defaultJobOptions: {
    attempts: config.orderProcessing.maxRetryAttempts,
    backoff: {
      type: 'exponential',
      delay: 1000, // Start with 1 second, doubles each retry
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 7200, // Keep failed jobs for 2 hours
      count: 5000, // Keep last 5000 failed jobs
    },
  },
});

// Create queue events for monitoring
export const orderQueueEvents = new QueueEvents('orders', {
  connection: createRedisConnection(),
});

// Log queue events
orderQueueEvents.on('waiting', ({ jobId }) => {
  console.log(`📋 Job ${jobId} is waiting`);
});

orderQueueEvents.on('active', ({ jobId }) => {
  console.log(`⚡ Job ${jobId} is now active`);
});

orderQueueEvents.on('completed', ({ jobId }) => {
  console.log(`✅ Job ${jobId} completed successfully`);
});

orderQueueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`❌ Job ${jobId} failed:`, failedReason);
});

// Helper function to add order to queue
export const addOrderToQueue = async (order: Order): Promise<string> => {
  const job = await orderQueue.add(
    'process-order',
    {
      orderId: order.id,
      order,
    },
    {
      jobId: order.id, // Use order ID as job ID for easy tracking
    }
  );

  return job.id || order.id;
};

// Helper function to get queue metrics
export const getQueueMetrics = async () => {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    orderQueue.getWaitingCount(),
    orderQueue.getActiveCount(),
    orderQueue.getCompletedCount(),
    orderQueue.getFailedCount(),
    orderQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + delayed,
  };
};

// Graceful shutdown
export const closeQueue = async () => {
  console.log('Closing order queue...');
  await orderQueue.close();
  await orderQueueEvents.close();
  await connection.quit();
};
