import { OrderRepository } from '../repositories';
import { DexRouterService } from './dex';
// import { OrderService } from './OrderService';
import { wsManager } from './WebSocketManager';
import { Order, OrderStatus } from '../types';
import { addOrderToQueue } from '../queue';

interface PriceCheckResult {
  orderId: string;
  currentPrice: number;
  limitPrice: number;
  priceReached: boolean;
}

export class PriceMonitorService {
  private orderRepository: OrderRepository;
  private dexRouter: DexRouterService;
  // private orderService: OrderService;
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private checkIntervalMs: number = 10000; // 10 seconds default
  private priceMatchThreshold: number = 0.001; // 0.1% threshold

  constructor() {
    this.orderRepository = new OrderRepository();
    this.dexRouter = new DexRouterService();
    // this.orderService = new OrderService();
  }

  /**
   * Start monitoring limit orders
   */
  async startMonitoring(intervalMs: number = 10000, threshold: number = 0.001): Promise<void> {
    if (this.isMonitoring) {
      console.log('⚠️  Price monitoring is already running');
      return;
    }

    this.checkIntervalMs = intervalMs;
    this.priceMatchThreshold = threshold;
    this.isMonitoring = true;

    console.log(`🔍 Starting price monitoring service...`);
    console.log(`   Check interval: ${this.checkIntervalMs}ms`);
    console.log(`   Price threshold: ${this.priceMatchThreshold * 100}%`);

    // Run initial check
    await this.checkLimitOrders();

    // Set up recurring checks for limit orders
    this.monitoringInterval = setInterval(async () => {
      await this.checkLimitOrders();
    }, this.checkIntervalMs);

    // Set up separate cleanup for expired orders (run every minute)
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupExpiredOrders();
    }, 60000); // 1 minute

    console.log('✅ Price monitoring service started');
  }

  /**
   * Stop monitoring limit orders
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isMonitoring = false;
    console.log('🛑 Price monitoring service stopped');
  }

  /**
   * Check all active limit orders for price targets
   */
  async checkLimitOrders(): Promise<void> {
    try {
      // Get all active limit orders
      const activeLimitOrders = await this.orderRepository.findActiveLimitOrders();

      if (activeLimitOrders.length === 0) {
        return;
      }

      console.log(`\n🔍 Checking ${activeLimitOrders.length} active limit orders...`);

      // Check for expired orders first
      await this.handleExpiredOrders(activeLimitOrders);

      // Check prices for each active limit order
      const priceChecks = activeLimitOrders
        .filter(order => !this.isExpired(order))
        .map(order => this.checkOrderPrice(order));

      const results = await Promise.allSettled(priceChecks);

      // Process results
      const triggered = results.filter(
        r => r.status === 'fulfilled' && r.value.priceReached
      ).length;

      if (triggered > 0) {
        console.log(`✨ ${triggered} limit order(s) triggered for execution`);
      }
    } catch (error) {
      console.error('❌ Error checking limit orders:', error);
    }
  }

  /**
   * Check if a specific order's price target has been reached
   */
  private async checkOrderPrice(order: Order, retryCount = 0): Promise<PriceCheckResult> {
    const maxRetries = 3;

    try {
      if (!order.limitPrice) {
        return {
          orderId: order.id,
          currentPrice: 0,
          limitPrice: 0,
          priceReached: false,
        };
      }

      // Get current market price with retry logic
      const quote = await this.dexRouter.getBestQuote({
        pair: order.pair,
        amountIn: order.amount,
      });

      const currentPrice = quote.bestQuote.price;
      const limitPrice = order.limitPrice;

      // Check if price target is reached (within threshold)
      // The threshold allows for small price fluctuations and prevents false triggers
      const priceDifference = Math.abs(currentPrice - limitPrice) / limitPrice;
      const priceReached = priceDifference <= this.priceMatchThreshold && currentPrice >= limitPrice;

      if (priceReached) {
        console.log(
          `🎯 Price target reached for order ${order.id}: ${order.pair} @ ${currentPrice.toFixed(4)} (target: ${limitPrice.toFixed(4)})`
        );

        // Broadcast price target reached via WebSocket
        wsManager.broadcastOrderUpdate(order.id, {
          orderId: order.id,
          status: OrderStatus.WAITING_FOR_PRICE,
          message: `Price target reached: ${currentPrice.toFixed(4)} (target: ${limitPrice.toFixed(4)})`,
          currentPrice,
          limitPrice,
        });

        await this.triggerLimitOrderExecution(order, currentPrice);
      }

      return {
        orderId: order.id,
        currentPrice,
        limitPrice,
        priceReached,
      };
    } catch (error) {
      console.error(`Error checking price for order ${order.id} (attempt ${retryCount + 1}/${maxRetries}):`, error);

      // Retry logic for transient errors
      if (retryCount < maxRetries - 1) {
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s
        console.log(`🔄 Retrying price check for order ${order.id} in ${retryDelay}ms...`);

        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return this.checkOrderPrice(order, retryCount + 1);
      }

      // Max retries reached, return failure
      console.error(`❌ Failed to check price for order ${order.id} after ${maxRetries} attempts`);
      return {
        orderId: order.id,
        currentPrice: 0,
        limitPrice: order.limitPrice || 0,
        priceReached: false,
      };
    }
  }

  /**
   * Trigger execution of a limit order when price target is reached
   */
  private async triggerLimitOrderExecution(order: Order, currentPrice: number): Promise<void> {
    try {
      // Double-check order is still in WAITING_FOR_PRICE status to prevent duplicate execution
      const currentOrder = await this.orderRepository.findById(order.id);

      if (!currentOrder || currentOrder.status !== OrderStatus.WAITING_FOR_PRICE) {
        console.log(`⚠️  Order ${order.id} is no longer waiting for price (status: ${currentOrder?.status}), skipping execution`);
        return;
      }

      // Update status to PENDING (will be processed like a market order)
      // This acts as a lock to prevent duplicate processing
      const updated = await this.orderRepository.updateStatus(
        order.id,
        OrderStatus.PENDING,
        `Price target reached at ${currentPrice.toFixed(4)}, triggering execution`
      );

      if (!updated) {
        console.log(`⚠️  Failed to update order ${order.id} status, skipping execution`);
        return;
      }

      // Add to queue for immediate processing
      await addOrderToQueue(updated);

      console.log(`✅ Limit order ${order.id} queued for execution`);
    } catch (error) {
      console.error(`Failed to trigger limit order execution for ${order.id}:`, error);

      // Only update to FAILED if order is still in a triggerable state
      const currentOrder = await this.orderRepository.findById(order.id);
      if (currentOrder && (currentOrder.status === OrderStatus.WAITING_FOR_PRICE || currentOrder.status === OrderStatus.PENDING)) {
        await this.orderRepository.updateExecutionDetails(order.id, {
          status: OrderStatus.FAILED,
          error: `Failed to trigger execution: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }
  }

  /**
   * Handle expired limit orders
   */
  private async handleExpiredOrders(orders: Order[]): Promise<void> {
    const expiredOrders = orders.filter(order => this.isExpired(order));

    if (expiredOrders.length === 0) {
      return;
    }

    console.log(`⏰ Found ${expiredOrders.length} expired limit order(s)`);

    for (const order of expiredOrders) {
      try {
        await this.orderRepository.updateExecutionDetails(order.id, {
          status: OrderStatus.EXPIRED,
          error: 'Order expired before price target was reached',
        });

        // Broadcast expiration via WebSocket
        wsManager.broadcastOrderUpdate(order.id, {
          orderId: order.id,
          status: OrderStatus.EXPIRED,
          error: 'Order expired before price target was reached',
        });

        console.log(`⏰ Order ${order.id} marked as EXPIRED`);
      } catch (error) {
        console.error(`Failed to mark order ${order.id} as expired:`, error);
      }
    }
  }

  /**
   * Check if an order has expired
   */
  private isExpired(order: Order): boolean {
    if (!order.expiresAt) {
      return false;
    }
    return new Date(order.expiresAt) <= new Date();
  }

  /**
   * Get monitoring status
   */
  getStatus(): { isMonitoring: boolean; intervalMs: number; threshold: number } {
    return {
      isMonitoring: this.isMonitoring,
      intervalMs: this.checkIntervalMs,
      threshold: this.priceMatchThreshold,
    };
  }

  /**
   * Manually trigger a price check for a specific order
   */
  async checkSpecificOrder(orderId: string): Promise<PriceCheckResult | null> {
    try {
      const order = await this.orderRepository.findById(orderId);
      if (!order) {
        console.log(`Order ${orderId} not found`);
        return null;
      }

      if (order.status !== OrderStatus.WAITING_FOR_PRICE) {
        console.log(`Order ${orderId} is not waiting for price (status: ${order.status})`);
        return null;
      }

      return await this.checkOrderPrice(order);
    } catch (error) {
      console.error(`Error checking specific order ${orderId}:`, error);
      return null;
    }
  }

  /**
   * Scheduled cleanup for expired orders
   * Runs periodically to mark expired limit orders
   */
  private async cleanupExpiredOrders(): Promise<void> {
    try {
      const expiredOrders = await this.orderRepository.findExpiredLimitOrders();

      if (expiredOrders.length === 0) {
        return;
      }

      console.log(`\n🧹 Cleaning up ${expiredOrders.length} expired limit order(s)...`);

      for (const order of expiredOrders) {
        try {
          await this.orderRepository.updateExecutionDetails(order.id, {
            status: OrderStatus.EXPIRED,
            error: 'Order expired before price target was reached',
          });

          // Broadcast expiration via WebSocket
          wsManager.broadcastOrderUpdate(order.id, {
            orderId: order.id,
            status: OrderStatus.EXPIRED,
            error: 'Order expired before price target was reached',
          });

          console.log(`⏰ Order ${order.id} marked as EXPIRED`);
        } catch (error) {
          console.error(`Failed to mark order ${order.id} as expired:`, error);
        }
      }
    } catch (error) {
      console.error('❌ Error during expired orders cleanup:', error);
    }
  }
}
