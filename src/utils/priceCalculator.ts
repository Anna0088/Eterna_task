import { TradingPair } from '../types';

// Base prices for trading pairs (realistic market prices)
// Only supporting BTC, ETH for now - others can be added as needed
export const BASE_PRICES: Partial<Record<TradingPair, number>> = {
  [TradingPair.BTC_USDT]: 43000, // BTC price in USDT
  [TradingPair.ETH_USDT]: 2300, // ETH price in USDT
  [TradingPair.BTC_ETH]: 18.7, // BTC price in ETH (43000 / 2300)
};

// Calculate output amount based on price
export const calculateOutputAmount = (
  amountIn: number,
  price: number,
  fee: number
): number => {
  const amountAfterFee = amountIn * (1 - fee);
  return amountAfterFee * price;
};

// Calculate effective price after fees
export const calculateEffectivePrice = (price: number, fee: number): number => {
  return price * (1 - fee);
};

// Get base price for a trading pair
export const getBasePrice = (pair: TradingPair): number => {
  const price = BASE_PRICES[pair];
  if (price === undefined) {
    throw new Error(`Price not available for trading pair: ${pair}`);
  }
  return price;
};

// Calculate slippage impact
export const applySlippage = (amount: number, slippage: number): number => {
  return amount * (1 - slippage);
};
