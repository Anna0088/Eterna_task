import dotenv from 'dotenv';
import { TradingPair } from '../types';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/dex-order-engine',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  orderProcessing: {
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_ORDERS || '10', 10),
    ordersPerMinute: parseInt(process.env.ORDERS_PER_MINUTE || '100', 10),
    maxRetryAttempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3', 10),
  },
  trading: {
    defaultSlippage: parseFloat(process.env.DEFAULT_SLIPPAGE || '0.01'),
    priceVariationMin: parseFloat(process.env.PRICE_VARIATION_MIN || '0.02'),
    priceVariationMax: parseFloat(process.env.PRICE_VARIATION_MAX || '0.05'),
    mockMode: process.env.MOCK_MODE !== 'false',
    supportedPairs: [TradingPair.BTC_USDT, TradingPair.ETH_USDT, TradingPair.BTC_ETH],
  },
};

export * from './database';