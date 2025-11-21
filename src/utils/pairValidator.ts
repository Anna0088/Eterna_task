import { TradingPair } from '../types';
import { config } from '../config';

export const isValidTradingPair = (pair: string): pair is TradingPair => {
  return config.trading.supportedPairs.includes(pair as TradingPair);
};

export const validateTradingPair = (pair: string): TradingPair => {
  if (!isValidTradingPair(pair)) {
    throw new Error(
      `Invalid trading pair: ${pair}. Supported pairs: ${config.trading.supportedPairs.join(', ')}`
    );
  }
  return pair;
};

export const getSupportedPairs = (): TradingPair[] => {
  return config.trading.supportedPairs as TradingPair[];
};
