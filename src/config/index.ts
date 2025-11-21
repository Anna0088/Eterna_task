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
    minSolBalance: parseFloat(process.env.MIN_SOL_BALANCE || '0.1'),
    computeUnitPrice: parseInt(process.env.COMPUTE_UNIT_PRICE || '1', 10),
    computeUnitLimit: parseInt(process.env.COMPUTE_UNIT_LIMIT || '200000', 10),
    supportedPairs: [
      // USDT pairs (10 pairs)
      TradingPair.BTC_USDT,
      TradingPair.ETH_USDT,
      TradingPair.SOL_USDT,
      TradingPair.BNB_USDT,
      TradingPair.XRP_USDT,
      TradingPair.ADA_USDT,
      TradingPair.DOGE_USDT,
      TradingPair.MATIC_USDT,
      TradingPair.DOT_USDT,
      TradingPair.AVAX_USDT,

      // Cross pairs (15 pairs)
      TradingPair.BTC_ETH,
      TradingPair.BTC_SOL,
      TradingPair.BTC_BNB,
      TradingPair.ETH_SOL,
      TradingPair.ETH_BNB,
      TradingPair.ETH_XRP,
      TradingPair.SOL_BNB,
      TradingPair.SOL_ADA,
      TradingPair.SOL_DOGE,
      TradingPair.BNB_XRP,
      TradingPair.BNB_ADA,
      TradingPair.XRP_ADA,
      TradingPair.MATIC_DOT,
      TradingPair.DOT_AVAX,
      TradingPair.ADA_DOGE,
    ],
  },
  solana: process.env.MOCK_MODE === 'false' ? {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    rpcBackupUrl: process.env.SOLANA_RPC_BACKUP,
    commitment: process.env.SOLANA_COMMITMENT || 'confirmed',
    confirmTimeout: parseInt(process.env.SOLANA_CONFIRM_TIMEOUT || '30000', 10),
    maxRetries: parseInt(process.env.SOLANA_MAX_RETRIES || '3', 10),
    privateKey: process.env.SOLANA_PRIVATE_KEY,
  } : undefined,
};

export * from './database';
export * from './redis';
export * from './solana';