import { DexType, Quote, ExecutionResult, DexQuoteRequest, TradingPair } from '../../types';
import { MockRaydiumService } from './MockRaydiumService';
import { MockMeteoraService } from './MockMeteoraService';

export interface DexRouterResult {
  selectedDex: DexType;
  raydiumQuote: Quote;
  meteoraQuote: Quote;
  bestQuote: Quote;
  reason: string;
}

export class DexRouterService {
  private raydiumService: MockRaydiumService;
  private meteoraService: MockMeteoraService;

  constructor() {
    this.raydiumService = new MockRaydiumService();
    this.meteoraService = new MockMeteoraService();
  }

  /**
   * Get quotes from both DEXs and select the best one
   */
  async getBestQuote(request: DexQuoteRequest): Promise<DexRouterResult> {
    // Fetch quotes from both DEXs in parallel
    const [raydiumQuote, meteoraQuote] = await Promise.all([
      this.raydiumService.getQuote(request),
      this.meteoraService.getQuote(request),
    ]);

    // Compare estimated outputs (higher is better)
    const bestQuote =
      raydiumQuote.estimatedOutput > meteoraQuote.estimatedOutput ? raydiumQuote : meteoraQuote;

    const selectedDex = bestQuote.dex;

    // Calculate the difference for logging
    const outputDifference = Math.abs(
      raydiumQuote.estimatedOutput - meteoraQuote.estimatedOutput
    );
    const percentageDifference =
      (outputDifference / Math.min(raydiumQuote.estimatedOutput, meteoraQuote.estimatedOutput)) *
      100;

    const reason =
      selectedDex === DexType.RAYDIUM
        ? `Raydium offers ${percentageDifference.toFixed(2)}% better output (${raydiumQuote.estimatedOutput.toFixed(4)} vs ${meteoraQuote.estimatedOutput.toFixed(4)})`
        : `Meteora offers ${percentageDifference.toFixed(2)}% better output (${meteoraQuote.estimatedOutput.toFixed(4)} vs ${raydiumQuote.estimatedOutput.toFixed(4)})`;

    return {
      selectedDex,
      raydiumQuote,
      meteoraQuote,
      bestQuote,
      reason,
    };
  }

  /**
   * Execute swap on the selected DEX
   */
  async executeSwap(
    dex: DexType,
    pair: TradingPair,
    amountIn: number,
    expectedPrice: number,
    slippage: number
  ): Promise<ExecutionResult> {
    if (dex === DexType.RAYDIUM) {
      return this.raydiumService.executeSwap(pair, amountIn, expectedPrice, slippage);
    } else {
      return this.meteoraService.executeSwap(pair, amountIn, expectedPrice, slippage);
    }
  }

  /**
   * Get a specific DEX service
   */
  getDexService(dex: DexType): MockRaydiumService | MockMeteoraService {
    return dex === DexType.RAYDIUM ? this.raydiumService : this.meteoraService;
  }

  /**
   * Get quote from a specific DEX
   */
  async getQuoteFromDex(dex: DexType, request: DexQuoteRequest): Promise<Quote> {
    if (dex === DexType.RAYDIUM) {
      return this.raydiumService.getQuote(request);
    } else {
      return this.meteoraService.getQuote(request);
    }
  }
}
