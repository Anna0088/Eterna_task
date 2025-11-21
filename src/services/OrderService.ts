import { OrderRepository } from '../repositories';
import { DexRouterService } from './dex';
import { wsManager } from './WebSocketManager';
import { Order, OrderRequest, OrderStatus, OrderType, TradingPair } from '../types';
import { validateTradingPair } from '../utils';
import { config } from '../config';

export class OrderService {
  private orderRepository: OrderRepository;
  private dexRouter: DexRouterService;

  constructor() {
    this.orderRepository = new OrderRepository();
    this.dexRouter = new DexRouterService();
  }

  /**
   * Create a new order
   */
  async createOrder(request: OrderRequest): Promise<Order> {
    // Validate trading pair
    const pair = validateTradingPair(request.pair);

    // Determine initial status and message based on order type
    const isLimitOrder = request.type === OrderType.LIMIT;
    const initialStatus = isLimitOrder ? OrderStatus.WAITING_FOR_PRICE : OrderStatus.PENDING;
    const initialMessage = isLimitOrder
      ? `LIMIT order created, waiting for price target: ${request.limitPrice}`
      : 'Order created and queued';

    // Set default expiration for limit orders if not provided
    let expiresAt = request.expiresAt;
    if (isLimitOrder && !expiresAt) {
      // Default to 24 hours from now
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    // Create order in database
    const order = await this.orderRepository.create({
      type: request.type,
      pair,
      amount: request.amount,
      slippage: request.slippage || config.trading.defaultSlippage,
      limitPrice: request.limitPrice,
      expiresAt,
      status: initialStatus,
      statusHistory: [
        {
          status: initialStatus,
          timestamp: new Date(),
          message: initialMessage,
        },
      ],
    });

    return order;
  }

  /**
   * Process an order (called by worker)
   */
  async processOrder(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    try {
      // Update status to ROUTING
      await this.orderRepository.updateStatus(
        orderId,
        OrderStatus.ROUTING,
        'Fetching quotes from DEXs'
      );
      wsManager.broadcastOrderUpdate(orderId, {
        orderId,
        status: OrderStatus.ROUTING,
        message: 'Fetching quotes from DEXs',
      });

      // Get best quote from DEX router
      const routingResult = await this.dexRouter.getBestQuote({
        pair: order.pair,
        amountIn: order.amount,
      });

      console.log(`🔀 ${order.pair} - ${routingResult.reason}`);

      // Update status to BUILDING
      await this.orderRepository.updateStatus(
        orderId,
        OrderStatus.BUILDING,
        `Building transaction on ${routingResult.selectedDex}`
      );
      wsManager.broadcastOrderUpdate(orderId, {
        orderId,
        status: OrderStatus.BUILDING,
        message: `Building transaction on ${routingResult.selectedDex}`,
        dex: routingResult.selectedDex,
        price: routingResult.bestQuote.price,
      });

      // Execute the swap
      const executionResult = await this.dexRouter.executeSwap(
        routingResult.selectedDex,
        order.pair,
        order.amount,
        routingResult.bestQuote.price,
        order.slippage
      );

      // Check if execution was successful
      if (!executionResult.success) {
        await this.orderRepository.updateExecutionDetails(orderId, {
          status: OrderStatus.FAILED,
          error: executionResult.error || 'Execution failed',
          dexUsed: executionResult.dex,
        });
        wsManager.broadcastOrderUpdate(orderId, {
          orderId,
          status: OrderStatus.FAILED,
          error: executionResult.error || 'Execution failed',
          dex: executionResult.dex,
        });

        const failedOrder = await this.orderRepository.findById(orderId);
        if (!failedOrder) throw new Error('Order not found after failure');
        return failedOrder;
      }

      // Update status to SUBMITTED
      await this.orderRepository.updateStatus(
        orderId,
        OrderStatus.SUBMITTED,
        'Transaction submitted to blockchain'
      );
      wsManager.broadcastOrderUpdate(orderId, {
        orderId,
        status: OrderStatus.SUBMITTED,
        message: 'Transaction submitted to blockchain',
      });

      // Update status to CONFIRMED with execution details
      await this.orderRepository.updateExecutionDetails(orderId, {
        status: OrderStatus.CONFIRMED,
        dexUsed: executionResult.dex,
        executionPrice: executionResult.executedPrice,
        txHash: executionResult.txHash,
      });
      wsManager.broadcastOrderUpdate(orderId, {
        orderId,
        status: OrderStatus.CONFIRMED,
        message: 'Order executed successfully',
        dex: executionResult.dex,
        price: executionResult.executedPrice,
        txHash: executionResult.txHash,
      });

      const completedOrder = await this.orderRepository.findById(orderId);
      if (!completedOrder) throw new Error('Order not found after completion');

      console.log(`✅ Order ${orderId} completed - TX: ${executionResult.txHash}`);
      return completedOrder;
    } catch (error) {
      // Handle any errors during processing
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Order ${orderId} processing error:`, errorMessage);

      await this.orderRepository.updateExecutionDetails(orderId, {
        status: OrderStatus.FAILED,
        error: errorMessage,
      });
      wsManager.broadcastOrderUpdate(orderId, {
        orderId,
        status: OrderStatus.FAILED,
        error: errorMessage,
      });

      const failedOrder = await this.orderRepository.findById(orderId);
      if (!failedOrder) throw error;
      return failedOrder;
    }
  }

  /**
   * Get order by ID
   */
  async getOrder(orderId: string): Promise<Order | null> {
    return this.orderRepository.findById(orderId);
  }

  /**
   * Get orders by status
   */
  async getOrdersByStatus(status: OrderStatus, limit = 100): Promise<Order[]> {
    return this.orderRepository.findByStatus(status, limit);
  }

  /**
   * Get orders by pair
   */
  async getOrdersByPair(pair: TradingPair, limit = 100): Promise<Order[]> {
    return this.orderRepository.findByPair(pair, limit);
  }

  /**
   * Get all orders
   */
  async getAllOrders(skip = 0, limit = 50): Promise<Order[]> {
    return this.orderRepository.findAll(skip, limit);
  }

  /**
   * Get active limit orders
   */
  async getActiveLimitOrders(_limit = 100): Promise<Order[]> {
    return this.orderRepository.findActiveLimitOrders();
  }

  /**
   * Cancel a limit order
   */
  async cancelOrder(orderId: string): Promise<{ success: boolean; message: string; order?: Order }> {
    try {
      const order = await this.orderRepository.findById(orderId);

      if (!order) {
        return {
          success: false,
          message: `Order ${orderId} not found`,
        };
      }

      // Only allow cancellation of orders in WAITING_FOR_PRICE or PENDING status
      if (order.status !== OrderStatus.WAITING_FOR_PRICE && order.status !== OrderStatus.PENDING) {
        return {
          success: false,
          message: `Cannot cancel order in ${order.status} status. Only WAITING_FOR_PRICE or PENDING orders can be cancelled.`,
          order,
        };
      }

      // Update order status to CANCELLED
      await this.orderRepository.updateExecutionDetails(orderId, {
        status: OrderStatus.CANCELLED,
        error: 'Order cancelled by user',
      });

      // Broadcast cancellation via WebSocket
      wsManager.broadcastOrderUpdate(orderId, {
        orderId,
        status: OrderStatus.CANCELLED,
        message: 'Order cancelled by user',
      });

      const cancelledOrder = await this.orderRepository.findById(orderId);

      console.log(`🚫 Order ${orderId} cancelled by user`);

      return {
        success: true,
        message: 'Order cancelled successfully',
        order: cancelledOrder || undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to cancel order ${orderId}:`, errorMessage);

      return {
        success: false,
        message: `Failed to cancel order: ${errorMessage}`,
      };
    }
  }
}
