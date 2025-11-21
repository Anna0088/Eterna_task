import { buildApp } from './app';
import { config, connectDatabase } from './config';

const start = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Build and start the app
    const app = await buildApp();

    await app.listen({ port: config.port, host: '0.0.0.0' });

    console.log(`\n🚀 Server running at http://localhost:${config.port}`);
    console.log(`💚 Health check: http://localhost:${config.port}/health`);
    console.log(`📊 Supported pairs: ${config.trading.supportedPairs.join(', ')}`);
    console.log(`🔧 Mock mode: ${config.trading.mockMode ? 'enabled' : 'disabled'}\n`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();