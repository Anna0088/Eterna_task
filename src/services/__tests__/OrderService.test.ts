import { OrderService } from '../OrderService';
import { OrderType, OrderStatus, TradingPair } from '../../types';
import { connectDatabase, disconnectDatabase } from '../../config/database';

describe('OrderService', () => {
  let orderService: OrderService;

  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(() => {
    orderService = new OrderService();
  });

  describe('createOrder', () => {
    it('should create a new order with valid data', async () => {
      const order = await orderService.createOrder({
        type: OrderType.MARKET,
        pair: TradingPair.BTC_USDT,
        amount: 1,
        slippage: 0.01,
      });

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(order.type).toBe(OrderType.MARKET);
      expect(order.pair).toBe(TradingPair.BTC_USDT);
      expect(order.amount).toBe(1);
      expect(order.slippage).toBe(0.01);
      expect(order.status).toBe(OrderStatus.PENDING);
      expect(order.statusHistory).toHaveLength(1);
      expect(order.statusHistory[0].status).toBe(OrderStatus.PENDING);
    });

    it('should use default slippage if not provided', async () => {
      const order = await orderService.createOrder({
        type: OrderType.MARKET,
        pair: TradingPair.ETH_USDT,
        amount: 10,
      });

      expect(order.slippage).toBe(0.01); // Default from config
    });

    it('should throw error for invalid trading pair', async () => {
      await expect(
        orderService.createOrder({
          type: OrderType.MARKET,
          pair: 'INVALID/PAIR' as TradingPair,
          amount: 1,
        })
      ).rejects.toThrow('Invalid trading pair');
    });

    it('should create orders for all supported pairs', async () => {
      const pairs = [TradingPair.BTC_USDT, TradingPair.ETH_USDT, TradingPair.BTC_ETH];

      for (const pair of pairs) {
        const order = await orderService.createOrder({
          type: OrderType.MARKET,
          pair,
          amount: 1,
        });

        expect(order.pair).toBe(pair);
      }
    });
  });

  describe('getOrder', () => {
    it('should retrieve an order by ID', async () => {
      const created = await orderService.createOrder({
        type: OrderType.MARKET,
        pair: TradingPair.BTC_USDT,
        amount: 1,
      });

      const retrieved = await orderService.getOrder(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.pair).toBe(created.pair);
    });

    it('should return null for non-existent order', async () => {
      const result = await orderService.getOrder('000000000000000000000000');
      expect(result).toBeNull();
    });
  });

  describe('getOrdersByStatus', () => {
    it('should retrieve orders by status', async () => {
      await orderService.createOrder({
        type: OrderType.MARKET,
        pair: TradingPair.BTC_USDT,
        amount: 1,
      });

      const pendingOrders = await orderService.getOrdersByStatus(OrderStatus.PENDING);

      expect(Array.isArray(pendingOrders)).toBe(true);
      expect(pendingOrders.length).toBeGreaterThan(0);
      expect(pendingOrders.every((o) => o.status === OrderStatus.PENDING)).toBe(true);
    });
  });

  describe('getOrdersByPair', () => {
    it('should retrieve orders by trading pair', async () => {
      await orderService.createOrder({
        type: OrderType.MARKET,
        pair: TradingPair.ETH_USDT,
        amount: 5,
      });

      const orders = await orderService.getOrdersByPair(TradingPair.ETH_USDT);

      expect(Array.isArray(orders)).toBe(true);
      expect(orders.every((o) => o.pair === TradingPair.ETH_USDT)).toBe(true);
    });
  });
});
