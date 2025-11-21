export interface AppConfig {
  env: string;
  port: number;
  mongodb: MongoDBConfig;
  redis: RedisConfig;
  logging: LoggingConfig;
  orderProcessing: OrderProcessingConfig;
  trading: TradingConfig;
}

export interface MongoDBConfig {
  uri: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
}

export interface LoggingConfig {
  level: string;
}

export interface OrderProcessingConfig {
  maxConcurrent: number;
  ordersPerMinute: number;
  maxRetryAttempts: number;
}

export interface TradingConfig {
  defaultSlippage: number;
  priceVariationMin: number;
  priceVariationMax: number;
  mockMode: boolean;
  supportedPairs: string[];
}
