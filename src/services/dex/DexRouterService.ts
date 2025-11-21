import { DexType, Quote, ExecutionResult, DexQuoteRequest, TradingPair } from '../../types';
import { MockRaydiumService } from './MockRaydiumService';
import { MockMeteoraService } from './MockMeteoraService';
import { RealRaydiumService } from './RealRaydiumService';
import { RealMeteoraService } from './RealMeteoraService';
import { config } from '../../config';

export interface DexRouterResult {
  selectedDex: DexType;
  raydiumQuote: Quote;
  meteoraQuote: Quote;
  bestQuote: Quote;
  reason: string;
  executionContext?: {
    raydiumAvailable: boolean;
    meteoraAvailable: boolean;
    quoteErrors?: string[];
  };
}

// Union types for service interfaces
type RaydiumService = MockRaydiumService | RealRaydiumService;
type MeteoraService = MockMeteoraService | RealMeteoraService;

export class DexRouterService {
  private raydiumService: RaydiumService;
  private meteoraService: MeteoraService;
  private readonly mockMode: boolean;

  constructor() {
    this.mockMode = config.trading.mockMode;

    if (this.mockMode) {
      console.log('[DexRouter] Initializing in MOCK mode');
      this.raydiumService = new MockRaydiumService();
      this.meteoraService = new MockMeteoraService();
    } else {
      console.log('[DexRouter] Initializing in REAL mode (Solana Devnet)');
      this.raydiumService = new RealRaydiumService();
      this.meteoraService = new RealMeteoraService();
    }
  }

  /**
   * Get quotes from both DEXs and select the best one
   * Implements error handling and fallback logic
   */
  async getBestQuote(request: DexQuoteRequest): Promise<DexRouterResult> {
    const errors: string[] = [];
    let raydiumQuote: Quote | null = null;
    let meteoraQuote: Quote | null = null;

    // Fetch quotes from both DEXs in parallel with error handling
    const quotePromises = await Promise.allSettled([
      this.raydiumService.getQuote(request),
      this.meteoraService.getQuote(request),
    ]);

    // Extract Raydium quote
    if (quotePromises[0].status === 'fulfilled') {
      raydiumQuote = quotePromises[0].value;
    } else {
      const error = `Raydium quote failed: ${quotePromises[0].reason}`;
      errors.push(error);
      console.error(`[DexRouter] ${error}`);
    }

    // Extract Meteora quote
    if (quotePromises[1].status === 'fulfilled') {
      meteoraQuote = quotePromises[1].value;
    } else {
      const error = `Meteora quote failed: ${quotePromises[1].reason}`;
      errors.push(error);
      console.error(`[DexRouter] ${error}`);
    }

    // If both failed, throw error
    if (!raydiumQuote && !meteoraQuote) {
      throw new Error(
        `Unable to get quotes from any DEX. Errors: ${errors.join('; ')}`
      );
    }

    // If only one DEX available, use it
    if (!raydiumQuote && meteoraQuote) {
      console.warn('[DexRouter] Only Meteora available, using it as fallback');
      return {
        selectedDex: DexType.METEORA,
        raydiumQuote: meteoraQuote, // Use Meteora for both to prevent null
        meteoraQuote,
        bestQuote: meteoraQuote,
        reason: 'Meteora only available (Raydium failed)',
        executionContext: {
          raydiumAvailable: false,
          meteoraAvailable: true,
          quoteErrors: errors,
        },
      };
    }

    if (raydiumQuote && !meteoraQuote) {
      console.warn('[DexRouter] Only Raydium available, using it as fallback');
      return {
        selectedDex: DexType.RAYDIUM,
        raydiumQuote,
        meteoraQuote: raydiumQuote, // Use Raydium for both to prevent null
        bestQuote: raydiumQuote,
        reason: 'Raydium only available (Meteora failed)',
        executionContext: {
          raydiumAvailable: true,
          meteoraAvailable: false,
          quoteErrors: errors,
        },
      };
    }

    // Both quotes available - select the best one
    // Primary criterion: estimated output (higher is better)
    // Secondary criterion: fee (lower is better) if outputs are very close

    const outputDifference = Math.abs(
      raydiumQuote!.estimatedOutput - meteoraQuote!.estimatedOutput
    );
    const minOutput = Math.min(raydiumQuote!.estimatedOutput, meteoraQuote!.estimatedOutput);
    const percentageDifference = (outputDifference / minOutput) * 100;

    let selectedDex: DexType;
    let bestQuote: Quote;
    let reason: string;

    // If outputs are within 0.1% of each other, consider fees
    if (percentageDifference < 0.1) {
      if (raydiumQuote!.fee < meteoraQuote!.fee) {
        selectedDex = DexType.RAYDIUM;
        bestQuote = raydiumQuote!;
        reason = `Outputs nearly equal, Raydium has lower fee (${(raydiumQuote!.fee * 100).toFixed(3)}% vs ${(meteoraQuote!.fee * 100).toFixed(3)}%)`;
      } else {
        selectedDex = DexType.METEORA;
        bestQuote = meteoraQuote!;
        reason = `Outputs nearly equal, Meteora has lower fee (${(meteoraQuote!.fee * 100).toFixed(3)}% vs ${(raydiumQuote!.fee * 100).toFixed(3)}%)`;
      }
    } else {
      // Significant output difference, choose higher output
      if (raydiumQuote!.estimatedOutput > meteoraQuote!.estimatedOutput) {
        selectedDex = DexType.RAYDIUM;
        bestQuote = raydiumQuote!;
        reason = `Raydium offers ${percentageDifference.toFixed(2)}% better output (${raydiumQuote!.estimatedOutput.toFixed(4)} vs ${meteoraQuote!.estimatedOutput.toFixed(4)})`;
      } else {
        selectedDex = DexType.METEORA;
        bestQuote = meteoraQuote!;
        reason = `Meteora offers ${percentageDifference.toFixed(2)}% better output (${meteoraQuote!.estimatedOutput.toFixed(4)} vs ${raydiumQuote!.estimatedOutput.toFixed(4)})`;
      }
    }

    console.log(`[DexRouter] Selected ${selectedDex}: ${reason}`);

    return {
      selectedDex,
      raydiumQuote: raydiumQuote!,
      meteoraQuote: meteoraQuote!,
      bestQuote,
      reason,
      executionContext: {
        raydiumAvailable: true,
        meteoraAvailable: true,
        quoteErrors: errors.length > 0 ? errors : undefined,
      },
    };
  }

  /**
   * Execute swap on the selected DEX with fallback logic
   */
  async executeSwap(
    dex: DexType,
    pair: TradingPair,
    amountIn: number,
    expectedPrice: number,
    slippage: number
  ): Promise<ExecutionResult> {
    try {
      console.log(`[DexRouter] Executing swap on ${dex} for ${amountIn} ${pair}`);

      let result: ExecutionResult;

      if (dex === DexType.RAYDIUM) {
        result = await this.raydiumService.executeSwap(pair, amountIn, expectedPrice, slippage);
      } else {
        result = await this.meteoraService.executeSwap(pair, amountIn, expectedPrice, slippage);
      }

      if (result.success) {
        console.log(
          `[DexRouter] Swap successful on ${dex}: ${result.actualOutput.toFixed(4)} output, fee: ${(result.fee * 100).toFixed(3)}%`
        );
      } else {
        console.error(`[DexRouter] Swap failed on ${dex}: ${result.error}`);
      }

      return result;
    } catch (error) {
      console.error(`[DexRouter] Swap execution error on ${dex}:`, error);

      // Return failed execution result
      return {
        success: false,
        dex,
        txHash: '',
        executedPrice: 0,
        actualOutput: 0,
        fee: 0,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error during swap execution',
      };
    }
  }

  /**
   * Get a specific DEX service
   */
  getDexService(dex: DexType): RaydiumService | MeteoraService {
    return dex === DexType.RAYDIUM ? this.raydiumService : this.meteoraService;
  }

  /**
   * Get quote from a specific DEX with error handling
   */
  async getQuoteFromDex(dex: DexType, request: DexQuoteRequest): Promise<Quote> {
    try {
      if (dex === DexType.RAYDIUM) {
        return await this.raydiumService.getQuote(request);
      } else {
        return await this.meteoraService.getQuote(request);
      }
    } catch (error) {
      console.error(`[DexRouter] Failed to get quote from ${dex}:`, error);
      throw error;
    }
  }

  /**
   * Get current market price for a trading pair
   * Lightweight version for price monitoring (uses small amount for quote)
   */
  async getCurrentPrice(pair: TradingPair): Promise<number> {
    try {
      // Use a small amount (0.1) to get the current price without significant slippage
      const quote = await this.getBestQuote({
        pair,
        amountIn: 0.1,
      });

      return quote.bestQuote.price;
    } catch (error) {
      console.error(`[DexRouter] Failed to get current price for ${pair}:`, error);
      throw error;
    }
  }

  /**
   * Get detailed quote comparison for analysis
   */
  async getQuoteComparison(request: DexQuoteRequest): Promise<{
    raydiumQuote: Quote | null;
    meteoraQuote: Quote | null;
    outputDifference: number;
    percentageDifference: number;
    feeComparison: {
      raydium: number;
      meteora: number;
      difference: number;
    } | null;
    recommendation: string;
  }> {
    const errors: string[] = [];
    let raydiumQuote: Quote | null = null;
    let meteoraQuote: Quote | null = null;

    // Fetch quotes with error handling
    const quotePromises = await Promise.allSettled([
      this.raydiumService.getQuote(request),
      this.meteoraService.getQuote(request),
    ]);

    if (quotePromises[0].status === 'fulfilled') {
      raydiumQuote = quotePromises[0].value;
    } else {
      errors.push(`Raydium: ${quotePromises[0].reason}`);
    }

    if (quotePromises[1].status === 'fulfilled') {
      meteoraQuote = quotePromises[1].value;
    } else {
      errors.push(`Meteora: ${quotePromises[1].reason}`);
    }

    // Calculate comparison metrics
    let outputDifference = 0;
    let percentageDifference = 0;
    let feeComparison = null;
    let recommendation = '';

    if (raydiumQuote && meteoraQuote) {
      outputDifference = Math.abs(raydiumQuote.estimatedOutput - meteoraQuote.estimatedOutput);
      const minOutput = Math.min(raydiumQuote.estimatedOutput, meteoraQuote.estimatedOutput);
      percentageDifference = (outputDifference / minOutput) * 100;

      feeComparison = {
        raydium: raydiumQuote.fee,
        meteora: meteoraQuote.fee,
        difference: Math.abs(raydiumQuote.fee - meteoraQuote.fee),
      };

      if (raydiumQuote.estimatedOutput > meteoraQuote.estimatedOutput) {
        recommendation = `Raydium recommended: ${percentageDifference.toFixed(2)}% better output`;
      } else {
        recommendation = `Meteora recommended: ${percentageDifference.toFixed(2)}% better output`;
      }
    } else if (raydiumQuote) {
      recommendation = 'Raydium only available';
    } else if (meteoraQuote) {
      recommendation = 'Meteora only available';
    } else {
      recommendation = `Both DEXs unavailable: ${errors.join('; ')}`;
    }

    return {
      raydiumQuote,
      meteoraQuote,
      outputDifference,
      percentageDifference,
      feeComparison,
      recommendation,
    };
  }

  /**
   * Check health of both DEX services
   */
  async checkDexHealth(): Promise<{
    raydium: boolean;
    meteora: boolean;
    overall: boolean;
  }> {
    const healthChecks = await Promise.allSettled([
      'checkConnectionHealth' in this.raydiumService
        ? (this.raydiumService as RealRaydiumService).checkConnectionHealth()
        : Promise.resolve(true), // Mock services don't have health checks
      'checkConnectionHealth' in this.meteoraService
        ? (this.meteoraService as RealMeteoraService).checkConnectionHealth()
        : Promise.resolve(true),
    ]);

    const raydiumHealthy = healthChecks[0].status === 'fulfilled' && healthChecks[0].value;
    const meteoraHealthy = healthChecks[1].status === 'fulfilled' && healthChecks[1].value;

    return {
      raydium: raydiumHealthy,
      meteora: meteoraHealthy,
      overall: raydiumHealthy || meteoraHealthy, // At least one must be healthy
    };
  }

  /**
   * Get the current operating mode
   */
  getMode(): 'mock' | 'real' {
    return this.mockMode ? 'mock' : 'real';
  }

  /**
   * Check if running in mock mode
   */
  isMockMode(): boolean {
    return this.mockMode;
  }
}
