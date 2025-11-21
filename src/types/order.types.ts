export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  SNIPER = 'sniper',
}

export enum OrderStatus {
  PENDING = 'pending',
  ROUTING = 'routing',
  BUILDING = 'building',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
}

export enum TradingPair {
  BTC_USDT = 'BTC/USDT',
  ETH_USDT = 'ETH/USDT',
  BTC_ETH = 'BTC/ETH',
}

export interface OrderRequest {
  type: OrderType;
  pair: TradingPair;
  amount: number;
  slippage?: number;
}

export interface Order {
  id: string;
  type: OrderType;
  pair: TradingPair;
  amount: number;
  slippage: number;
  status: OrderStatus;
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
