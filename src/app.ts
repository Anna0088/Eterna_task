import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config } from './config';
import { orderRoutes } from './router';
import { monitoringService } from './services/MonitoringService';

export async function buildApp(): Promise<FastifyInstance> {
  // Configure logger based on environment
  const loggerConfig = config.env === 'production'
    ? {
        // Production: structured JSON logging
        level: config.logging.level,
      }
    : {
        // Development: pretty printing
        level: config.logging.level,
        transport: {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      };

  const app = Fastify({
    logger: loggerConfig,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(websocket);

  // Register order routes
  await app.register(orderRoutes);

  // Enhanced health check endpoint with comprehensive monitoring
  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const health = await monitoringService.getSystemHealth();

    // Return appropriate HTTP status code based on health
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

    return reply.status(statusCode).send(health);
  });

  // Mode information endpoint
  app.get('/health/mode', async (_request: FastifyRequest, reply: FastifyReply) => {
    const modeInfo = monitoringService.getModeInfo();
    return reply.status(200).send(modeInfo);
  });

  // Performance metrics endpoint
  app.get('/health/metrics', async (_request: FastifyRequest, reply: FastifyReply) => {
    const metrics = await monitoringService.getPerformanceMetrics();
    return reply.status(200).send(metrics);
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    reply.status(500).send({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  });

  return app;
}