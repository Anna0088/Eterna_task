import { OrderRepository } from '../repositories';
import { DexRouterService } from './dex';
import { wsManager } from './WebSocketManager';
import { Order, OrderRequest, OrderStatus, TradingPair } from '../types';
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

    // Create order in database
    const order = await this.orderRepository.create({
      type: request.type,
      pair,
      amount: request.amount,
      slippage: request.slippage || config.trading.defaultSlippage,
      status: OrderStatus.PENDING,
      statusHistory: [
        {
          status: OrderStatus.PENDING,
          timestamp: new Date(),
          message: 'Order created and queued',
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
}
