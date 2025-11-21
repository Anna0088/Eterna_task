import { buildApp } from './app';
import { config, connectDatabase } from './config';
import { startWorker } from './queue';
import { PriceMonitorService } from './services/PriceMonitorService';

// Global price monitor instance
let priceMonitor: PriceMonitorService | null = null;

const start = async () => {
  try {
    // Connect to MongoDB
    await connectDatabase();

    // Start the order worker
    await startWorker();

    // Start price monitoring service for limit orders
    priceMonitor = new PriceMonitorService();
    await priceMonitor.startMonitoring(10000, 0.001); // 10s interval, 0.1% threshold

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

// Graceful shutdown
const shutdown = async () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (priceMonitor) {
    priceMonitor.stopMonitoring();
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();