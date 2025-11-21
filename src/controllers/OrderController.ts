import { FastifyRequest, FastifyReply } from 'fastify';
import { OrderService } from '../services/OrderService';
import { addOrderToQueue } from '../queue';
import { OrderRequest, OrderType, TradingPair } from '../types';

export class OrderController {
  private orderService: OrderService;

  constructor() {
    this.orderService = new OrderService();
  }

  /**
   * POST /api/orders/execute
   * Create and queue an order for execution
   */
  async executeOrder(
    request: FastifyRequest<{ Body: OrderRequest }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { type, pair, amount, slippage } = request.body;

      // Validate request body
      if (!type || !pair || !amount) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Missing required fields: type, pair, amount',
        });
      }

      // Validate order type
      if (!Object.values(OrderType).includes(type)) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: `Invalid order type. Supported types: ${Object.values(OrderType).join(', ')}`,
        });
      }

      // Validate amount
      if (amount <= 0) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Amount must be greater than 0',
        });
      }

      // Validate slippage if provided
      if (slippage !== undefined && (slippage < 0 || slippage > 1)) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Slippage must be between 0 and 1',
        });
      }

      // Create order
      const order = await this.orderService.createOrder({
        type,
        pair,
        amount,
        slippage,
      });

      // Add to queue for processing
      await addOrderToQueue(order);

      // Return order ID immediately
      return reply.status(201).send({
        orderId: order.id,
        status: order.status,
        message: 'Order created and queued for processing',
        order: {
          id: order.id,
          type: order.type,
          pair: order.pair,
          amount: order.amount,
          slippage: order.slippage,
          status: order.status,
          createdAt: order.createdAt,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if it's a validation error
      if (errorMessage.includes('Invalid trading pair')) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: errorMessage,
        });
      }

      // Internal server error
      request.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create order',
      });
    }
  }

  /**
   * GET /api/orders/:orderId
   * Get order status by ID
   */
  async getOrder(
    request: FastifyRequest<{ Params: { orderId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { orderId } = request.params;

      const order = await this.orderService.getOrder(orderId);

      if (!order) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `Order ${orderId} not found`,
        });
      }

      return reply.send({
        order,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve order',
      });
    }
  }

  /**
   * GET /api/orders
   * Get all orders with optional filters
   */
  async getOrders(
    request: FastifyRequest<{
      Querystring: { status?: string; pair?: string; skip?: string; limit?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { status, pair, skip, limit } = request.query;

      let orders;

      if (status) {
        orders = await this.orderService.getOrdersByStatus(
          status as any,
          limit ? parseInt(limit) : 100
        );
      } else if (pair) {
        orders = await this.orderService.getOrdersByPair(
          pair as TradingPair,
          limit ? parseInt(limit) : 100
        );
      } else {
        orders = await this.orderService.getAllOrders(
          skip ? parseInt(skip) : 0,
          limit ? parseInt(limit) : 50
        );
      }

      return reply.send({
        orders,
        count: orders.length,
      });
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve orders',
      });
    }
  }
}
