import { orderQueue, addOrderToQueue, getQueueMetrics } from '../orderQueue';
import { OrderType, OrderStatus, TradingPair, Order } from '../../types';

describe('Order Queue', () => {
  beforeAll(async () => {
    // Clean queue before tests
    await orderQueue.obliterate({ force: true });
  });

  afterAll(async () => {
    await orderQueue.close();
  });

  describe('addOrderToQueue', () => {
    it('should add order to queue', async () => {
      const mockOrder: Order = {
        id: 'test-order-1',
        type: OrderType.MARKET,
        pair: TradingPair.BTC_USDT,
        amount: 1,
        slippage: 0.01,
        status: OrderStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        statusHistory: [],
      };

      const jobId = await addOrderToQueue(mockOrder);

      expect(jobId).toBe(mockOrder.id);

      // Verify job was added
      const job = await orderQueue.getJob(jobId);
      expect(job).toBeDefined();
      expect(job?.data.orderId).toBe(mockOrder.id);
      expect(job?.data.order.pair).toBe(TradingPair.BTC_USDT);
    });

    it('should handle multiple orders', async () => {
      const orders: Order[] = [
        {
          id: 'test-order-2',
          type: OrderType.MARKET,
          pair: TradingPair.BTC_USDT,
          amount: 1,
          slippage: 0.01,
          status: OrderStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
          statusHistory: [],
        },
        {
          id: 'test-order-3',
          type: OrderType.MARKET,
          pair: TradingPair.ETH_USDT,
          amount: 10,
          slippage: 0.01,
          status: OrderStatus.PENDING,
          createdAt: new Date(),
          updatedAt: new Date(),
          statusHistory: [],
        },
      ];

      for (const order of orders) {
        await addOrderToQueue(order);
      }

      const metrics = await getQueueMetrics();
      expect(metrics.total).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getQueueMetrics', () => {
    it('should return queue metrics', async () => {
      const metrics = await getQueueMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics.waiting).toBe('number');
      expect(typeof metrics.active).toBe('number');
      expect(typeof metrics.completed).toBe('number');
      expect(typeof metrics.failed).toBe('number');
      expect(typeof metrics.delayed).toBe('number');
      expect(typeof metrics.total).toBe('number');
    });
  });
});
