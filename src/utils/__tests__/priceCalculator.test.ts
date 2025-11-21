import {
  BASE_PRICES,
  calculateOutputAmount,
  calculateEffectivePrice,
  getBasePrice,
  applySlippage,
} from '../priceCalculator';
import { TradingPair } from '../../types';

describe('priceCalculator', () => {
  describe('BASE_PRICES', () => {
    it('should have prices for all trading pairs', () => {
      expect(BASE_PRICES[TradingPair.BTC_USDT]).toBeDefined();
      expect(BASE_PRICES[TradingPair.ETH_USDT]).toBeDefined();
      expect(BASE_PRICES[TradingPair.BTC_ETH]).toBeDefined();
    });

    it('should have realistic prices', () => {
      expect(BASE_PRICES[TradingPair.BTC_USDT]).toBeGreaterThan(30000);
      expect(BASE_PRICES[TradingPair.ETH_USDT]).toBeGreaterThan(1000);
      expect(BASE_PRICES[TradingPair.BTC_ETH]).toBeGreaterThan(10);
    });
  });

  describe('calculateOutputAmount', () => {
    it('should calculate output with fee deduction', () => {
      const output = calculateOutputAmount(1, 43000, 0.003);

      // 1 * 43000 * (1 - 0.003) = 42871
      expect(output).toBeCloseTo(42871, 0);
    });

    it('should return higher output with lower fees', () => {
      const outputHighFee = calculateOutputAmount(1, 43000, 0.003);
      const outputLowFee = calculateOutputAmount(1, 43000, 0.002);

      expect(outputLowFee).toBeGreaterThan(outputHighFee);
    });

    it('should scale with input amount', () => {
      const output1 = calculateOutputAmount(1, 43000, 0.003);
      const output2 = calculateOutputAmount(2, 43000, 0.003);

      expect(output2).toBeCloseTo(output1 * 2, 0);
    });
  });

  describe('calculateEffectivePrice', () => {
    it('should calculate price after fee', () => {
      const effectivePrice = calculateEffectivePrice(43000, 0.003);

      // 43000 * (1 - 0.003) = 42871
      expect(effectivePrice).toBeCloseTo(42871, 0);
    });

    it('should return lower price with higher fees', () => {
      const price1 = calculateEffectivePrice(43000, 0.002);
      const price2 = calculateEffectivePrice(43000, 0.003);

      expect(price1).toBeGreaterThan(price2);
    });
  });

  describe('getBasePrice', () => {
    it('should return correct base price for each pair', () => {
      expect(getBasePrice(TradingPair.BTC_USDT)).toBe(BASE_PRICES[TradingPair.BTC_USDT]);
      expect(getBasePrice(TradingPair.ETH_USDT)).toBe(BASE_PRICES[TradingPair.ETH_USDT]);
      expect(getBasePrice(TradingPair.BTC_ETH)).toBe(BASE_PRICES[TradingPair.BTC_ETH]);
    });
  });

  describe('applySlippage', () => {
    it('should reduce amount by slippage percentage', () => {
      const result = applySlippage(100, 0.01);

      // 100 * (1 - 0.01) = 99
      expect(result).toBe(99);
    });

    it('should handle zero slippage', () => {
      const result = applySlippage(100, 0);
      expect(result).toBe(100);
    });

    it('should handle maximum slippage', () => {
      const result = applySlippage(100, 0.5);
      expect(result).toBe(50);
    });
  });
});
