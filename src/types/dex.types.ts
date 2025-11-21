import { TradingPair } from './order.types';

export enum DexType {
  RAYDIUM = 'raydium',
  METEORA = 'meteora',
}

export interface Quote {
  dex: DexType;
  pair: TradingPair;
  price: number;
  fee: number;
  estimatedOutput: number;
  timestamp: Date;
}

export interface ExecutionResult {
  success: boolean;
  dex: DexType;
  txHash: string;
  executedPrice: number;
  actualOutput: number;
  fee: number;
  timestamp: Date;
  error?: string;
}

export interface DexQuoteRequest {
  pair: TradingPair;
  amountIn: number;
}
