export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  SNIPER = 'sniper',
}

export enum OrderStatus {
  PENDING = 'pending',
  WAITING_FOR_PRICE = 'waiting_for_price',
  ROUTING = 'routing',
  BUILDING = 'building',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum TradingPair {
  // USDT pairs (10 pairs)
  BTC_USDT = 'BTC/USDT',
  ETH_USDT = 'ETH/USDT',
  SOL_USDT = 'SOL/USDT',
  BNB_USDT = 'BNB/USDT',
  XRP_USDT = 'XRP/USDT',
  ADA_USDT = 'ADA/USDT',
  DOGE_USDT = 'DOGE/USDT',
  MATIC_USDT = 'MATIC/USDT',
  DOT_USDT = 'DOT/USDT',
  AVAX_USDT = 'AVAX/USDT',

  // Cross pairs (15 pairs)
  BTC_ETH = 'BTC/ETH',
  BTC_SOL = 'BTC/SOL',
  BTC_BNB = 'BTC/BNB',
  ETH_SOL = 'ETH/SOL',
  ETH_BNB = 'ETH/BNB',
  ETH_XRP = 'ETH/XRP',
  SOL_BNB = 'SOL/BNB',
  SOL_ADA = 'SOL/ADA',
  SOL_DOGE = 'SOL/DOGE',
  BNB_XRP = 'BNB/XRP',
  BNB_ADA = 'BNB/ADA',
  XRP_ADA = 'XRP/ADA',
  MATIC_DOT = 'MATIC/DOT',
  DOT_AVAX = 'DOT/AVAX',
  ADA_DOGE = 'ADA/DOGE',
}

export interface OrderRequest {
  type: OrderType;
  pair: TradingPair;
  amount: number;
  slippage?: number;
  limitPrice?: number;
  expiresAt?: Date;
}

export interface Order {
  id: string;
  type: OrderType;
  pair: TradingPair;
  amount: number;
  slippage: number;
  status: OrderStatus;
  limitPrice?: number;
  expiresAt?: Date;
  dexUsed?: string;
  executionPrice?: number;
  txHash?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  statusHistory: StatusHistoryEntry[];
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  timestamp: Date;
  message?: string;
}
