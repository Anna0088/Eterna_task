import { DexType, Quote, ExecutionResult, DexQuoteRequest, TradingPair } from '../../types';
import { sleep } from '../../utils/sleep';
import { generateMockTxHash, randomInRange } from '../../utils/mockData';
import { getBasePrice, calculateOutputAmount } from '../../utils/priceCalculator';
import { config } from '../../config';

export class MockRaydiumService {
  private readonly RAYDIUM_FEE = 0.003; // 0.3% fee
  private readonly QUOTE_DELAY = 200; // 200ms to simulate network delay
  private readonly EXECUTION_DELAY_MIN = 2000; // 2s min
  private readonly EXECUTION_DELAY_MAX = 3000; // 3s max

  async getQuote(request: DexQuoteRequest): Promise<Quote> {
    // Simulate network delay
    await sleep(this.QUOTE_DELAY);

    const basePrice = getBasePrice(request.pair);

    // Add price variance (2-5% as per config)
    const priceVariance = randomInRange(
      config.trading.priceVariationMin,
      config.trading.priceVariationMax
    );

    // Raydium tends to have slightly higher prices
    const price = basePrice * (1 + priceVariance * 0.5);

    const estimatedOutput = calculateOutputAmount(request.amountIn, price, this.RAYDIUM_FEE);

    return {
      dex: DexType.RAYDIUM,
      pair: request.pair,
      price,
      fee: this.RAYDIUM_FEE,
      estimatedOutput,
      timestamp: new Date(),
    };
  }

  async executeSwap(
    _pair: TradingPair,
    amountIn: number,
    expectedPrice: number,
    slippage: number
  ): Promise<ExecutionResult> {
    // Simulate execution delay (2-3 seconds)
    const executionDelay = randomInRange(this.EXECUTION_DELAY_MIN, this.EXECUTION_DELAY_MAX);
    await sleep(executionDelay);

    // Simulate minor price slippage during execution (up to configured slippage)
    const actualSlippage = randomInRange(0, slippage * 0.8); // Use up to 80% of allowed slippage
    const executedPrice = expectedPrice * (1 - actualSlippage);

    const actualOutput = calculateOutputAmount(amountIn, executedPrice, this.RAYDIUM_FEE);

    // 95% success rate for simulation
    const success = Math.random() > 0.05;

    if (!success) {
      return {
        success: false,
        dex: DexType.RAYDIUM,
        txHash: '',
        executedPrice: 0,
        actualOutput: 0,
        fee: this.RAYDIUM_FEE,
        timestamp: new Date(),
        error: 'Simulated execution failure - insufficient liquidity',
      };
    }

    return {
      success: true,
      dex: DexType.RAYDIUM,
      txHash: generateMockTxHash(),
      executedPrice,
      actualOutput,
      fee: this.RAYDIUM_FEE,
      timestamp: new Date(),
    };
  }

  getDexName(): string {
    return 'Raydium';
  }

  getFeeRate(): number {
    return this.RAYDIUM_FEE;
  }
}
