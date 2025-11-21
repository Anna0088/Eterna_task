import { isValidTradingPair, validateTradingPair, getSupportedPairs } from '../pairValidator';
import { TradingPair } from '../../types';

describe('pairValidator', () => {
  describe('isValidTradingPair', () => {
    it('should return true for valid pairs', () => {
      expect(isValidTradingPair('BTC/USDT')).toBe(true);
      expect(isValidTradingPair('ETH/USDT')).toBe(true);
      expect(isValidTradingPair('BTC/ETH')).toBe(true);
    });

    it('should return false for invalid pairs', () => {
      expect(isValidTradingPair('SOL/USDT')).toBe(false);
      expect(isValidTradingPair('INVALID')).toBe(false);
      expect(isValidTradingPair('')).toBe(false);
    });
  });

  describe('validateTradingPair', () => {
    it('should return valid pair', () => {
      expect(validateTradingPair('BTC/USDT')).toBe(TradingPair.BTC_USDT);
      expect(validateTradingPair('ETH/USDT')).toBe(TradingPair.ETH_USDT);
      expect(validateTradingPair('BTC/ETH')).toBe(TradingPair.BTC_ETH);
    });

    it('should throw error for invalid pair', () => {
      expect(() => validateTradingPair('SOL/USDT')).toThrow('Invalid trading pair');
      expect(() => validateTradingPair('INVALID')).toThrow('Invalid trading pair');
    });

    it('should include supported pairs in error message', () => {
      expect(() => validateTradingPair('INVALID')).toThrow('BTC/USDT');
      expect(() => validateTradingPair('INVALID')).toThrow('ETH/USDT');
      expect(() => validateTradingPair('INVALID')).toThrow('BTC/ETH');
    });
  });

  describe('getSupportedPairs', () => {
    it('should return all supported pairs', () => {
      const pairs = getSupportedPairs();

      expect(pairs).toContain(TradingPair.BTC_USDT);
      expect(pairs).toContain(TradingPair.ETH_USDT);
      expect(pairs).toContain(TradingPair.BTC_ETH);
      expect(pairs).toHaveLength(3);
    });
  });
});
