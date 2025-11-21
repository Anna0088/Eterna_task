import { FastifyInstance, FastifyRequest } from 'fastify';
import { OrderController } from '../controllers';
import { wsManager } from '../services/WebSocketManager';

export async function orderRoutes(app: FastifyInstance) {
  const orderController = new OrderController();

  // POST /api/orders/execute - Create and execute order
  app.post('/api/orders/execute', async (request, reply) => {
    return orderController.executeOrder(request as any, reply);
  });

  // GET /api/orders/:orderId - Get order by ID
  app.get<{ Params: { orderId: string } }>('/api/orders/:orderId', async (request, reply) => {
    return orderController.getOrder(request, reply);
  });

  // GET /api/orders - Get all orders with filters
  app.get('/api/orders', async (request, reply) => {
    return orderController.getOrders(request as any, reply);
  });

  // WebSocket endpoint for order status updates
  // GET /api/orders/:orderId/ws - Subscribe to order updates
  app.get<{ Params: { orderId: string } }>(
    '/api/orders/:orderId/ws',
    { websocket: true },
    (connection: any, request: FastifyRequest<{ Params: { orderId: string } }>) => {
      const { orderId } = request.params;

      // Register WebSocket client
      wsManager.addClient(connection.socket, orderId);

      // Send initial connection confirmation
      connection.socket.send(
        JSON.stringify({
          type: 'connected',
          orderId,
          message: `Connected to order ${orderId} updates`,
          timestamp: new Date().toISOString(),
        })
      );

      console.log(`WebSocket connection established for order ${orderId}`);
    }
  );

  // General WebSocket endpoint for subscribing to multiple orders
  app.get(
    '/api/orders/ws',
    { websocket: true },
    (connection: any, _request) => {
      // Register WebSocket client without specific order
      wsManager.addClient(connection.socket);

      // Send initial connection confirmation
      connection.socket.send(
        JSON.stringify({
          type: 'connected',
          message: 'Connected to order updates stream',
          timestamp: new Date().toISOString(),
        })
      );

      console.log(`WebSocket connection established (general stream)`);
    }
  );
}
