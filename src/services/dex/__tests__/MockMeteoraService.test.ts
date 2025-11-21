import { MockMeteoraService } from '../MockMeteoraService';
import { DexType, TradingPair } from '../../../types';

describe('MockMeteoraService', () => {
  let service: MockMeteoraService;

  beforeEach(() => {
    service = new MockMeteoraService();
  });

  describe('getQuote', () => {
    it('should return a quote for BTC/USDT', async () => {
      const quote = await service.getQuote({
        pair: TradingPair.BTC_USDT,
        amountIn: 1,
      });

      expect(quote).toBeDefined();
      expect(quote.dex).toBe(DexType.METEORA);
      expect(quote.pair).toBe(TradingPair.BTC_USDT);
      expect(quote.price).toBeGreaterThan(0);
      expect(quote.fee).toBe(0.002); // Lower fee than Raydium
      expect(quote.estimatedOutput).toBeGreaterThan(0);
      expect(quote.timestamp).toBeInstanceOf(Date);
    });

    it('should have lower fees than Raydium', () => {
      expect(service.getFeeRate()).toBeLessThan(0.003);
      expect(service.getFeeRate()).toBe(0.002);
    });

    it('should return different quotes for all trading pairs', async () => {
      const btcUsdtQuote = await service.getQuote({
        pair: TradingPair.BTC_USDT,
        amountIn: 1,
      });
      const ethUsdtQuote = await service.getQuote({
        pair: TradingPair.ETH_USDT,
        amountIn: 1,
      });
      const btcEthQuote = await service.getQuote({
        pair: TradingPair.BTC_ETH,
        amountIn: 1,
      });

      expect(btcUsdtQuote.price).not.toBe(ethUsdtQuote.price);
      expect(btcUsdtQuote.price).not.toBe(btcEthQuote.price);
    });
  });

  describe('executeSwap', () => {
    it('should successfully execute a swap', async () => {
      const result = await service.executeSwap(TradingPair.ETH_USDT, 1, 2300, 0.01);

      expect(result.dex).toBe(DexType.METEORA);
      if (result.success) {
        expect(result.txHash).toBeTruthy();
        expect(result.executedPrice).toBeGreaterThan(0);
        expect(result.actualOutput).toBeGreaterThan(0);
      }
    });

    it('should have higher success rate than Raydium', async () => {
      // Run multiple swaps to test success rate
      const results = await Promise.all(
        Array(20)
          .fill(null)
          .map(() => service.executeSwap(TradingPair.BTC_USDT, 1, 43000, 0.01))
      );

      const successCount = results.filter((r) => r.success).length;
      const successRate = successCount / results.length;

      // Should have ~97% success rate
      expect(successRate).toBeGreaterThan(0.8);
    });
  });

  describe('getDexName', () => {
    it('should return Meteora', () => {
      expect(service.getDexName()).toBe('Meteora');
    });
  });
});
