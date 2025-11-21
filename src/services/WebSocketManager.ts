import { WebSocket } from 'ws';
import { OrderStatusUpdate } from '../types';

interface WebSocketClient {
  ws: WebSocket;
  orderId?: string;
  subscriptions: Set<string>;
}

export class WebSocketManager {
  private clients: Map<string, WebSocketClient>;
  private clientIdCounter: number;

  constructor() {
    this.clients = new Map();
    this.clientIdCounter = 0;
  }

  /**
   * Register a new WebSocket connection
   */
  addClient(ws: WebSocket, orderId?: string): string {
    const clientId = `client_${++this.clientIdCounter}`;

    const client: WebSocketClient = {
      ws,
      orderId,
      subscriptions: new Set(orderId ? [orderId] : []),
    };

    this.clients.set(clientId, client);

    // Setup close handler
    ws.on('close', () => {
      this.removeClient(clientId);
    });

    // Setup error handler
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.removeClient(clientId);
    });

    // Setup message handler for subscriptions
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(clientId, message);
      } catch (error) {
        console.error(`Failed to parse WebSocket message from ${clientId}:`, error);
      }
    });

    console.log(`📡 WebSocket client ${clientId} connected${orderId ? ` for order ${orderId}` : ''}`);
    return clientId;
  }

  /**
   * Remove a WebSocket client
   */
  removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.ws.close();
      this.clients.delete(clientId);
      console.log(`📡 WebSocket client ${clientId} disconnected`);
    }
  }

  /**
   * Handle messages from clients (for subscriptions)
   */
  private handleClientMessage(clientId: string, message: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (message.type === 'subscribe' && message.orderId) {
      client.subscriptions.add(message.orderId);
      console.log(`Client ${clientId} subscribed to order ${message.orderId}`);
    } else if (message.type === 'unsubscribe' && message.orderId) {
      client.subscriptions.delete(message.orderId);
      console.log(`Client ${clientId} unsubscribed from order ${message.orderId}`);
    }
  }

  /**
   * Broadcast status update to all clients subscribed to this order
   */
  broadcastOrderUpdate(orderId: string, update: OrderStatusUpdate): void {
    const message = JSON.stringify({
      type: 'status_update',
      orderId,
      status: update.status,
      message: update.message,
      dex: update.dex,
      price: update.price,
      txHash: update.txHash,
      error: update.error,
      timestamp: new Date().toISOString(),
    });

    let sentCount = 0;

    this.clients.forEach((client) => {
      // Send to clients subscribed to this order
      if (client.subscriptions.has(orderId)) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(message);
          sentCount++;
        }
      }
    });

    if (sentCount > 0) {
      console.log(`📤 Broadcast order ${orderId} update to ${sentCount} client(s): ${update.status}`);
    }
  }

  /**
   * Send error message to a specific client
   */
  sendError(clientId: string, error: string): void {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(
        JSON.stringify({
          type: 'error',
          message: error,
          timestamp: new Date().toISOString(),
        })
      );
    }
  }

  /**
   * Get count of active connections
   */
  getActiveConnectionCount(): number {
    return this.clients.size;
  }

  /**
   * Get count of clients subscribed to a specific order
   */
  getSubscriberCount(orderId: string): number {
    let count = 0;
    this.clients.forEach((client) => {
      if (client.subscriptions.has(orderId)) {
        count++;
      }
    });
    return count;
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    console.log('Closing all WebSocket connections...');
    this.clients.forEach((_client, clientId) => {
      this.removeClient(clientId);
    });
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
