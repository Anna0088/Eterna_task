import { buildApp } from '../../app';
import { FastifyInstance } from 'fastify';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import { startWorker, stopWorker } from '../../queue';
import { OrderType, TradingPair } from '../../types';

describe('OrderController E2E', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await connectDatabase();
    await startWorker();
    app = await buildApp();
  });

  afterAll(async () => {
    await stopWorker();
    await app.close();
    await disconnectDatabase();
  });

  describe('POST /api/orders/execute', () => {
    it('should create and queue an order', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          type: OrderType.MARKET,
          pair: TradingPair.BTC_USDT,
          amount: 1,
          slippage: 0.01,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.orderId).toBeDefined();
      expect(body.status).toBe('pending');
      expect(body.order.type).toBe(OrderType.MARKET);
      expect(body.order.pair).toBe(TradingPair.BTC_USDT);
    });

    it('should reject invalid trading pair', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          type: OrderType.MARKET,
          pair: 'INVALID/PAIR',
          amount: 1,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Validation Error');
      expect(body.message).toContain('Invalid trading pair');
    });

    it('should reject missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          type: OrderType.MARKET,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Missing required fields');
    });

    it('should reject invalid amount', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          type: OrderType.MARKET,
          pair: TradingPair.BTC_USDT,
          amount: -1,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('Amount must be greater than 0');
    });
  });

  describe('GET /api/orders/:orderId', () => {
    it('should retrieve an order by ID', async () => {
      // First create an order
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/orders/execute',
        payload: {
          type: OrderType.MARKET,
          pair: TradingPair.ETH_USDT,
          amount: 5,
        },
      });

      const { orderId } = JSON.parse(createResponse.body);

      // Then retrieve it
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/orders/${orderId}`,
      });

      expect(getResponse.statusCode).toBe(200);
      const body = JSON.parse(getResponse.body);
      expect(body.order.id).toBe(orderId);
      expect(body.order.pair).toBe(TradingPair.ETH_USDT);
    });

    it('should return 404 for non-existent order', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/orders/000000000000000000000000',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not Found');
    });
  });

  describe('GET /api/orders', () => {
    it('should retrieve all orders', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/orders',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.orders)).toBe(true);
      expect(body.count).toBeDefined();
    });

    it('should filter orders by status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/orders?status=pending',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.orders)).toBe(true);
    });

    it('should filter orders by pair', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/orders?pair=${TradingPair.BTC_USDT}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body.orders)).toBe(true);
    });
  });
});
