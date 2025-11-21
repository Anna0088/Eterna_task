import { OrderModel, OrderDocument } from '../models';
import { Order, OrderStatus } from '../types';

export class OrderRepository {
  /**
   * Create a new order
   */
  async create(orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<Order> {
    const order = new OrderModel(orderData);
    const saved = await order.save();
    return this.toOrder(saved);
  }

  /**
   * Find order by ID
   */
  async findById(id: string): Promise<Order | null> {
    const order = await OrderModel.findById(id);
    return order ? this.toOrder(order) : null;
  }

  /**
   * Update order status
   */
  async updateStatus(id: string, status: OrderStatus, message?: string): Promise<Order | null> {
    const order = await OrderModel.findById(id);
    if (!order) return null;

    order.status = status;
    if (message) {
      order.statusHistory.push({
        status,
        timestamp: new Date(),
        message,
      });
    }

    const updated = await order.save();
    return this.toOrder(updated);
  }

  /**
   * Update order with execution details
   */
  async updateExecutionDetails(
    id: string,
    details: {
      dexUsed?: string;
      executionPrice?: number;
      txHash?: string;
      status: OrderStatus;
      error?: string;
    }
  ): Promise<Order | null> {
    const order = await OrderModel.findById(id);
    if (!order) return null;

    if (details.dexUsed) order.dexUsed = details.dexUsed;
    if (details.executionPrice) order.executionPrice = details.executionPrice;
    if (details.txHash) order.txHash = details.txHash;
    if (details.error) order.error = details.error;
    order.status = details.status;

    const updated = await order.save();
    return this.toOrder(updated);
  }

  /**
   * Find orders by status
   */
  async findByStatus(status: OrderStatus, limit = 100): Promise<Order[]> {
    const orders = await OrderModel.find({ status })
      .sort({ createdAt: -1 })
      .limit(limit);

    return orders.map((o) => this.toOrder(o));
  }

  /**
   * Find orders by pair
   */
  async findByPair(pair: string, limit = 100): Promise<Order[]> {
    const orders = await OrderModel.find({ pair })
      .sort({ createdAt: -1 })
      .limit(limit);

    return orders.map((o) => this.toOrder(o));
  }

  /**
   * Find all orders with pagination
   */
  async findAll(skip = 0, limit = 50): Promise<Order[]> {
    const orders = await OrderModel.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return orders.map((o) => this.toOrder(o));
  }

  /**
   * Count orders by status
   */
  async countByStatus(status: OrderStatus): Promise<number> {
    return OrderModel.countDocuments({ status });
  }

  /**
   * Get total order count
   */
  async count(): Promise<number> {
    return OrderModel.countDocuments();
  }

  /**
   * Find active limit orders waiting for price
   */
  async findActiveLimitOrders(): Promise<Order[]> {
    const orders = await OrderModel.find({
      status: OrderStatus.WAITING_FOR_PRICE,
    }).sort({ createdAt: -1 });

    return orders.map((o) => this.toOrder(o));
  }

  /**
   * Find expired limit orders
   */
  async findExpiredLimitOrders(): Promise<Order[]> {
    const now = new Date();
    const orders = await OrderModel.find({
      status: OrderStatus.WAITING_FOR_PRICE,
      expiresAt: { $lte: now },
    }).sort({ expiresAt: 1 });

    return orders.map((o) => this.toOrder(o));
  }

  /**
   * Delete order by ID (for testing)
   */
  async delete(id: string): Promise<boolean> {
    const result = await OrderModel.findByIdAndDelete(id);
    return result !== null;
  }

  /**
   * Convert Mongoose document to Order type
   */
  private toOrder(doc: OrderDocument): Order {
    return {
      id: doc._id.toString(),
      type: doc.type,
      pair: doc.pair,
      amount: doc.amount,
      slippage: doc.slippage,
      status: doc.status,
      limitPrice: doc.limitPrice,
      expiresAt: doc.expiresAt,
      dexUsed: doc.dexUsed,
      executionPrice: doc.executionPrice,
      txHash: doc.txHash,
      error: doc.error,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      statusHistory: doc.statusHistory,
    };
  }
}
