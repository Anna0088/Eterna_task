import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
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
    return reply.status(200).send({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: config.env,
      uptime: process.uptime(),
    });
  });

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    reply.status(500).send({
      error: 'Internal Server Error',
      message: error.message,
    });
  });

  return app;
}