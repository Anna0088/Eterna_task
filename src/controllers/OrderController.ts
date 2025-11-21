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
      const { type, pair, amount, slippage, limitPrice, expiresAt } = request.body;

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

      // LIMIT order specific validations
      if (type === OrderType.LIMIT) {
        // Require limitPrice for LIMIT orders
        if (!limitPrice || limitPrice <= 0) {
          throw new ValidationError('LIMIT orders require a valid limitPrice greater than 0', 'limitPrice');
        }

        // Validate expiresAt if provided
        if (expiresAt) {
          const expiryDate = new Date(expiresAt);
          if (isNaN(expiryDate.getTime())) {
            throw new ValidationError('Invalid expiresAt date format', 'expiresAt');
          }
          if (expiryDate <= new Date()) {
            throw new ValidationError('expiresAt must be a future date', 'expiresAt');
          }
          // Max 30 days in the future
          const maxDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          if (expiryDate > maxDate) {
            throw new ValidationError('expiresAt cannot be more than 30 days in the future', 'expiresAt');
          }
        }

        // Check if user has reached max active limit orders
        const activeLimitOrders = await this.orderService.getActiveLimitOrders();
        if (activeLimitOrders.length >= 1000) {
          throw new ValidationError('Maximum number of active limit orders (1000) reached. Please cancel some orders first.', 'type');
        }
      }

      // MARKET order specific validations
      if (type === OrderType.MARKET) {
        // Ensure MARKET orders don't include limitPrice
        if (limitPrice !== undefined) {
          throw new ValidationError('MARKET orders cannot have a limitPrice', 'limitPrice');
        }
        if (expiresAt !== undefined) {
          throw new ValidationError('MARKET orders cannot have an expiresAt date', 'expiresAt');
        }
      }

      // Create order
      const order = await this.orderService.createOrder({
        type,
        pair,
        amount,
        slippage,
        limitPrice,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
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
      const responseMessage = type === OrderType.LIMIT
        ? 'LIMIT order created and monitoring for price target'
        : 'MARKET order created and queued for processing';

      return reply.status(201).send({
        orderId: order.id,
        status: order.status,
        message: responseMessage,
        order: {
          id: order.id,
          type: order.type,
          pair: order.pair,
          amount: order.amount,
          slippage: order.slippage,
          limitPrice: order.limitPrice,
          expiresAt: order.expiresAt,
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

  /**
   * GET /api/orders/limit/active
   * Get all active limit orders
   */
  async getActiveLimitOrders(
    request: FastifyRequest<{
      Querystring: { limit?: string };
    }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { limit } = request.query;
      const orders = await this.orderService.getActiveLimitOrders(
        limit ? parseInt(limit) : 100
      );

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
        message: 'Failed to retrieve active limit orders',
      });
    }
  }

  /**
   * DELETE /api/orders/:orderId/cancel
   * Cancel a pending limit order
   */
  async cancelOrder(
    request: FastifyRequest<{ Params: { orderId: string } }>,
    reply: FastifyReply
  ): Promise<void> {
    try {
      const { orderId } = request.params;

      const result = await this.orderService.cancelOrder(orderId);

      if (!result.success) {
        throw new ValidationError(result.message || 'Failed to cancel order', 'orderId');
      }

      return reply.send({
        orderId,
        status: result.order?.status,
        message: result.message,
      });
    } catch (error) {
      request.log.error(error);

      if (isAppError(error)) {
        return reply.status(error.statusCode).send(formatErrorResponse(error));
      }

      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to cancel order',
      });
    }
  }
}
