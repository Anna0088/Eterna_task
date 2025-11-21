import { buildApp } from './app';
import { config } from './config';

const start = async () => {
  try {
    const app = await buildApp();

    await app.listen({ port: config.port, host: '0.0.0.0' });

    console.log(`Server running at http://localhost:${config.port}`);
    console.log(`Health check available at http://localhost:${config.port}/health`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();