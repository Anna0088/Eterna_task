import { DexType, Quote, ExecutionResult, DexQuoteRequest, TradingPair } from '../../types';
import { sleep } from '../../utils/sleep';
import { generateMockTxHash, randomInRange } from '../../utils/mockData';
import { getBasePrice, calculateOutputAmount } from '../../utils/priceCalculator';
import { config } from '../../config';

export class MockMeteoraService {
  private readonly METEORA_FEE = 0.002; // 0.2% fee (slightly lower than Raydium)
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

    // Meteora tends to have slightly lower prices but better fees
    const price = basePrice * (1 - priceVariance * 0.3);

    const estimatedOutput = calculateOutputAmount(request.amountIn, price, this.METEORA_FEE);

    return {
      dex: DexType.METEORA,
      pair: request.pair,
      price,
      fee: this.METEORA_FEE,
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
    const actualSlippage = randomInRange(0, slippage * 0.7); // Use up to 70% of allowed slippage
    const executedPrice = expectedPrice * (1 - actualSlippage);

    const actualOutput = calculateOutputAmount(amountIn, executedPrice, this.METEORA_FEE);

    // 97% success rate for simulation (slightly better than Raydium)
    const success = Math.random() > 0.03;

    if (!success) {
      return {
        success: false,
        dex: DexType.METEORA,
        txHash: '',
        executedPrice: 0,
        actualOutput: 0,
        fee: this.METEORA_FEE,
        timestamp: new Date(),
        error: 'Simulated execution failure - price impact too high',
      };
    }

    return {
      success: true,
      dex: DexType.METEORA,
      txHash: generateMockTxHash(),
      executedPrice,
      actualOutput,
      fee: this.METEORA_FEE,
      timestamp: new Date(),
    };
  }

  getDexName(): string {
    return 'Meteora';
  }

  getFeeRate(): number {
    return this.METEORA_FEE;
  }
}
