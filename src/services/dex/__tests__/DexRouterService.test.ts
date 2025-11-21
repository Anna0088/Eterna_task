import { DexRouterService } from '../DexRouterService';
import { DexType, TradingPair } from '../../../types';

describe('DexRouterService', () => {
  let router: DexRouterService;

  beforeEach(() => {
    router = new DexRouterService();
  });

  describe('getBestQuote', () => {
    it('should return quotes from both DEXs', async () => {
      const result = await router.getBestQuote({
        pair: TradingPair.BTC_USDT,
        amountIn: 1,
      });

      expect(result.raydiumQuote).toBeDefined();
      expect(result.meteoraQuote).toBeDefined();
      expect(result.raydiumQuote.dex).toBe(DexType.RAYDIUM);
      expect(result.meteoraQuote.dex).toBe(DexType.METEORA);
    });

    it('should select the DEX with better output', async () => {
      const result = await router.getBestQuote({
        pair: TradingPair.BTC_USDT,
        amountIn: 1,
      });

      expect(result.bestQuote).toBeDefined();
      expect(result.selectedDex).toBeDefined();

      // Best quote should have the highest estimated output
      const maxOutput = Math.max(
        result.raydiumQuote.estimatedOutput,
        result.meteoraQuote.estimatedOutput
      );
      expect(result.bestQuote.estimatedOutput).toBe(maxOutput);
    });

    it('should provide a reason for selection', async () => {
      const result = await router.getBestQuote({
        pair: TradingPair.ETH_USDT,
        amountIn: 1,
      });

      expect(result.reason).toBeTruthy();
      expect(result.reason).toContain('offers');
      expect(result.reason).toContain('%');
      expect(result.reason).toContain('better output');
    });

    it('should work for all trading pairs', async () => {
      const pairs = [TradingPair.BTC_USDT, TradingPair.ETH_USDT, TradingPair.BTC_ETH];

      for (const pair of pairs) {
        const result = await router.getBestQuote({
          pair,
          amountIn: 1,
        });

        expect(result.raydiumQuote.pair).toBe(pair);
        expect(result.meteoraQuote.pair).toBe(pair);
        expect(result.bestQuote.pair).toBe(pair);
      }
    });

    it('should fetch quotes in parallel', async () => {
      const start = Date.now();
      await router.getBestQuote({
        pair: TradingPair.BTC_USDT,
        amountIn: 1,
      });
      const duration = Date.now() - start;

      // Should take ~200ms (parallel), not ~400ms (sequential)
      expect(duration).toBeLessThan(400);
      expect(duration).toBeGreaterThanOrEqual(150);
    });
  });

  describe('executeSwap', () => {
    it('should execute swap on Raydium', async () => {
      const result = await router.executeSwap(DexType.RAYDIUM, TradingPair.BTC_USDT, 1, 43000, 0.01);

      expect(result.dex).toBe(DexType.RAYDIUM);
      if (result.success) {
        expect(result.fee).toBe(0.003);
      }
    });

    it('should execute swap on Meteora', async () => {
      const result = await router.executeSwap(DexType.METEORA, TradingPair.ETH_USDT, 1, 2300, 0.01);

      expect(result.dex).toBe(DexType.METEORA);
      if (result.success) {
        expect(result.fee).toBe(0.002);
      }
    });
  });

  describe('getQuoteFromDex', () => {
    it('should get quote from specific DEX', async () => {
      const raydiumQuote = await router.getQuoteFromDex(DexType.RAYDIUM, {
        pair: TradingPair.BTC_USDT,
        amountIn: 1,
      });

      const meteoraQuote = await router.getQuoteFromDex(DexType.METEORA, {
        pair: TradingPair.BTC_USDT,
        amountIn: 1,
      });

      expect(raydiumQuote.dex).toBe(DexType.RAYDIUM);
      expect(meteoraQuote.dex).toBe(DexType.METEORA);
    });
  });

  describe('getDexService', () => {
    it('should return the correct DEX service', () => {
      const raydiumService = router.getDexService(DexType.RAYDIUM);
      const meteoraService = router.getDexService(DexType.METEORA);

      expect(raydiumService.getDexName()).toBe('Raydium');
      expect(meteoraService.getDexName()).toBe('Meteora');
    });
  });
});
