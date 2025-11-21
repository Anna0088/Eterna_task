import mongoose, { Schema, Document } from 'mongoose';
import { Order as IOrder, OrderType, OrderStatus, TradingPair, StatusHistoryEntry } from '../types';

export interface OrderDocument extends Omit<IOrder, 'id'>, Document {
  _id: mongoose.Types.ObjectId;
}

const StatusHistorySchema = new Schema<StatusHistoryEntry>(
  {
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    message: {
      type: String,
      required: false,
    },
  },
  { _id: false }
);

const OrderSchema = new Schema<OrderDocument>(
  {
    type: {
      type: String,
      enum: Object.values(OrderType),
      required: true,
      index: true,
    },
    pair: {
      type: String,
      enum: Object.values(TradingPair),
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    slippage: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      default: 0.01,
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      required: true,
      default: OrderStatus.PENDING,
      index: true,
    },
    dexUsed: {
      type: String,
      required: false,
    },
    executionPrice: {
      type: Number,
      required: false,
    },
    txHash: {
      type: String,
      required: false,
      index: true,
    },
    error: {
      type: String,
      required: false,
    },
    statusHistory: {
      type: [StatusHistorySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ pair: 1, status: 1 });

// Add status to history before saving
OrderSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
    });
  }
  next();
});

export const OrderModel = mongoose.model<OrderDocument>('Order', OrderSchema);
