import { FastifyRequest, FastifyReply } from 'fastify';
import { OrderService } from '../services/OrderService';
import { addOrderToQueue } from '../queue';
import { OrderRequest, OrderType, TradingPair } from '../types';
import { ValidationError, NotFoundError, QueueError, isAppError, formatErrorResponse } from '../utils/errors';

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
        throw new ValidationError('Missing required fields: type, pair, amount');
      }

      // Validate order type
      if (!Object.values(OrderType).includes(type)) {
        throw new ValidationError(
          `Invalid order type. Supported types: ${Object.values(OrderType).join(', ')}`,
          'type'
        );
      }

      // Validate amount
      if (amount <= 0) {
        throw new ValidationError('Amount must be greater than 0', 'amount');
      }

      // Validate slippage if provided
      if (slippage !== undefined && (slippage < 0 || slippage > 1)) {
        throw new ValidationError('Slippage must be between 0 and 1', 'slippage');
      }

      // Create order
      const order = await this.orderService.createOrder({
        type,
        pair,
        amount,
        slippage,
      });

      // Add to queue for processing
      try {
        await addOrderToQueue(order);
      } catch (queueError) {
        // If queue fails, log but still return order (it's created in DB)
        request.log.error(queueError, 'Failed to add order to queue');
        throw new QueueError('Failed to queue order for processing');
      }

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
      request.log.error(error);

      if (isAppError(error)) {
        return reply.status(error.statusCode).send(formatErrorResponse(error));
      }

      // Unknown error
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
        throw new NotFoundError('Order', orderId);
      }

      return reply.send({
        order,
      });
    } catch (error) {
      request.log.error(error);

      if (isAppError(error)) {
        return reply.status(error.statusCode).send(formatErrorResponse(error));
      }

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

      if (isAppError(error)) {
        return reply.status(error.statusCode).send(formatErrorResponse(error));
      }

      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to retrieve orders',
      });
    }
  }
}
