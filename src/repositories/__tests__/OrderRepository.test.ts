import { OrderRepository } from '../OrderRepository';
import { OrderType, OrderStatus, TradingPair } from '../../types';
import { connectDatabase, disconnectDatabase } from '../../config/database';

describe('OrderRepository', () => {
  let repository: OrderRepository;

  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  beforeEach(() => {
    repository = new OrderRepository();
  });

  describe('create', () => {
    it('should create a new order', async () => {
      const order = await repository.create({
        type: OrderType.MARKET,
        pair: TradingPair.BTC_USDT,
        amount: 1,
        slippage: 0.01,
        status: OrderStatus.PENDING,
        statusHistory: [],
      });

      expect(order).toBeDefined();
      expect(order.id).toBeDefined();
      expect(order.type).toBe(OrderType.MARKET);
      expect(order.pair).toBe(TradingPair.BTC_USDT);
    });
  });

  describe('findById', () => {
    it('should find order by ID', async () => {
      const created = await repository.create({
        type: OrderType.MARKET,
        pair: TradingPair.ETH_USDT,
        amount: 5,
        slippage: 0.01,
        status: OrderStatus.PENDING,
        statusHistory: [],
      });

      const found = await repository.findById(created.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it('should return null for non-existent ID', async () => {
      const result = await repository.findById('000000000000000000000000');
      expect(result).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should update order status', async () => {
      const order = await repository.create({
        type: OrderType.MARKET,
        pair: TradingPair.BTC_USDT,
        amount: 1,
        slippage: 0.01,
        status: OrderStatus.PENDING,
        statusHistory: [],
      });

      const updated = await repository.updateStatus(order.id, OrderStatus.ROUTING, 'Fetching quotes');

      expect(updated).toBeDefined();
      expect(updated?.status).toBe(OrderStatus.ROUTING);
      expect(updated?.statusHistory.some((h) => h.status === OrderStatus.ROUTING)).toBe(true);
    });
  });

  describe('updateExecutionDetails', () => {
    it('should update execution details', async () => {
      const order = await repository.create({
        type: OrderType.MARKET,
        pair: TradingPair.BTC_USDT,
        amount: 1,
        slippage: 0.01,
        status: OrderStatus.PENDING,
        statusHistory: [],
      });

      const updated = await repository.updateExecutionDetails(order.id, {
        status: OrderStatus.CONFIRMED,
        dexUsed: 'raydium',
        executionPrice: 43000,
        txHash: 'abc123',
      });

      expect(updated).toBeDefined();
      expect(updated?.status).toBe(OrderStatus.CONFIRMED);
      expect(updated?.dexUsed).toBe('raydium');
      expect(updated?.executionPrice).toBe(43000);
      expect(updated?.txHash).toBe('abc123');
    });
  });

  describe('findByStatus', () => {
    it('should find orders by status', async () => {
      await repository.create({
        type: OrderType.MARKET,
        pair: TradingPair.BTC_USDT,
        amount: 1,
        slippage: 0.01,
        status: OrderStatus.PENDING,
        statusHistory: [],
      });

      const orders = await repository.findByStatus(OrderStatus.PENDING);

      expect(Array.isArray(orders)).toBe(true);
      expect(orders.length).toBeGreaterThan(0);
      expect(orders.every((o) => o.status === OrderStatus.PENDING)).toBe(true);
    });
  });

  describe('count', () => {
    it('should count total orders', async () => {
      const initialCount = await repository.count();

      await repository.create({
        type: OrderType.MARKET,
        pair: TradingPair.BTC_USDT,
        amount: 1,
        slippage: 0.01,
        status: OrderStatus.PENDING,
        statusHistory: [],
      });

      const newCount = await repository.count();
      expect(newCount).toBe(initialCount + 1);
    });
  });
});
