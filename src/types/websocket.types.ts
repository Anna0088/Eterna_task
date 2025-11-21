import { OrderStatus } from './order.types';

export interface WebSocketMessage {
  type: 'status_update' | 'error' | 'complete';
  orderId: string;
  status?: OrderStatus;
  message?: string;
  data?: Record<string, unknown>;
  timestamp: Date;
}

export interface OrderStatusUpdate {
  orderId: string;
  status: OrderStatus;
  message?: string;
  dex?: string;
  price?: number;
  txHash?: string;
  error?: string;
}
