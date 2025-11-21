import { MockRaydiumService } from '../MockRaydiumService';
import { DexType, TradingPair } from '../../../types';

describe('MockRaydiumService', () => {
  let service: MockRaydiumService;

  beforeEach(() => {
    service = new MockRaydiumService();
  });

  describe('getQuote', () => {
    it('should return a quote for BTC/USDT', async () => {
      const quote = await service.getQuote({
        pair: TradingPair.BTC_USDT,
        amountIn: 1,
      });

      expect(quote).toBeDefined();
      expect(quote.dex).toBe(DexType.RAYDIUM);
      expect(quote.pair).toBe(TradingPair.BTC_USDT);
      expect(quote.price).toBeGreaterThan(0);
      expect(quote.fee).toBe(0.003);
      expect(quote.estimatedOutput).toBeGreaterThan(0);
      expect(quote.timestamp).toBeInstanceOf(Date);
    });

    it('should return a quote for ETH/USDT', async () => {
      const quote = await service.getQuote({
        pair: TradingPair.ETH_USDT,
        amountIn: 1,
      });

      expect(quote.dex).toBe(DexType.RAYDIUM);
      expect(quote.pair).toBe(TradingPair.ETH_USDT);
      expect(quote.price).toBeGreaterThan(0);
    });

    it('should return a quote for BTC/ETH', async () => {
      const quote = await service.getQuote({
        pair: TradingPair.BTC_ETH,
        amountIn: 1,
      });

      expect(quote.dex).toBe(DexType.RAYDIUM);
      expect(quote.pair).toBe(TradingPair.BTC_ETH);
      expect(quote.price).toBeGreaterThan(0);
    });

    it('should have realistic price variance', async () => {
      const quotes = await Promise.all([
        service.getQuote({ pair: TradingPair.BTC_USDT, amountIn: 1 }),
        service.getQuote({ pair: TradingPair.BTC_USDT, amountIn: 1 }),
        service.getQuote({ pair: TradingPair.BTC_USDT, amountIn: 1 }),
      ]);

      // Quotes should vary slightly
      const prices = quotes.map((q) => q.price);
      const uniquePrices = new Set(prices);
      expect(uniquePrices.size).toBeGreaterThan(1);
    });

    it('should simulate network delay', async () => {
      const start = Date.now();
      await service.getQuote({
        pair: TradingPair.BTC_USDT,
        amountIn: 1,
      });
      const duration = Date.now() - start;

      // Should take at least 200ms
      expect(duration).toBeGreaterThanOrEqual(150);
    });
  });

  describe('executeSwap', () => {
    it('should successfully execute a swap', async () => {
      const result = await service.executeSwap(TradingPair.BTC_USDT, 1, 43000, 0.01);

      expect(result.success).toBe(true);
      expect(result.dex).toBe(DexType.RAYDIUM);
      expect(result.txHash).toBeTruthy();
      expect(result.txHash.length).toBe(64); // 32 bytes = 64 hex chars
      expect(result.executedPrice).toBeGreaterThan(0);
      expect(result.actualOutput).toBeGreaterThan(0);
      expect(result.fee).toBe(0.003);
    });

    it('should apply slippage during execution', async () => {
      const expectedPrice = 43000;
      const result = await service.executeSwap(TradingPair.BTC_USDT, 1, expectedPrice, 0.01);

      if (result.success) {
        // Executed price should be slightly lower due to slippage
        expect(result.executedPrice).toBeLessThanOrEqual(expectedPrice);
        expect(result.executedPrice).toBeGreaterThan(expectedPrice * 0.99); // Within 1% slippage
      }
    });

    it('should simulate execution delay', async () => {
      const start = Date.now();
      await service.executeSwap(TradingPair.BTC_USDT, 1, 43000, 0.01);
      const duration = Date.now() - start;

      // Should take at least 2 seconds
      expect(duration).toBeGreaterThanOrEqual(1900);
    });
  });

  describe('getDexName', () => {
    it('should return Raydium', () => {
      expect(service.getDexName()).toBe('Raydium');
    });
  });

  describe('getFeeRate', () => {
    it('should return 0.3% fee', () => {
      expect(service.getFeeRate()).toBe(0.003);
    });
  });
});
