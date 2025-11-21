import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import mongoose from 'mongoose';
import { config } from './config';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logging.level,
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(websocket);

  app.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';

    return reply.status(200).send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.env,
      uptime: process.uptime(),
      database: dbStatus,
      supportedPairs: config.trading.supportedPairs,
    });
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