#!/usr/bin/env tsx
import { RealRaydiumService } from '../src/services/dex/RealRaydiumService';
import { TradingPair, DexQuoteRequest } from '../src/types';

/**
 * Test script for Raydium devnet integration
 *
 * This script tests:
 * 1. RPC connection health
 * 2. Quote fetching with various scenarios
 * 3. Swap execution simulation
 * 4. Error handling and retries
 */

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function logSuccess(message: string) {
  console.log(`${COLORS.green}✓${COLORS.reset} ${message}`);
}

function logError(message: string) {
  console.log(`${COLORS.red}✗${COLORS.reset} ${message}`);
}

function logInfo(message: string) {
  console.log(`${COLORS.blue}ℹ${COLORS.reset} ${message}`);
}

function logSection(message: string) {
  console.log(`\n${COLORS.cyan}${'='.repeat(60)}${COLORS.reset}`);
  console.log(`${COLORS.cyan}${message}${COLORS.reset}`);
  console.log(`${COLORS.cyan}${'='.repeat(60)}${COLORS.reset}\n`);
}

async function testConnectionHealth(service: RealRaydiumService): Promise<boolean> {
  logSection('TEST 1: RPC Connection Health');

  try {
    const isHealthy = await service.checkConnectionHealth();

    if (isHealthy) {
      logSuccess('RPC connection is healthy');
      return true;
    } else {
      logError('RPC connection health check failed');
      return false;
    }
  } catch (error) {
    logError(`Connection health check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function testPoolExistence(service: RealRaydiumService): Promise<boolean> {
  logSection('TEST 2: Pool Existence Check');

  const testCases = [
    { pair: TradingPair.BTC_USDT, shouldExist: true },
    { pair: TradingPair.ETH_USDT, shouldExist: true },
    { pair: TradingPair.BTC_ETH, shouldExist: true },
    { pair: 'INVALID/PAIR' as TradingPair, shouldExist: false },
  ];

  let allPassed = true;

  for (const testCase of testCases) {
    try {
      const exists = await service.checkPoolExists(testCase.pair);

      if (exists === testCase.shouldExist) {
        logSuccess(`Pool ${testCase.pair}: ${exists ? 'exists' : 'does not exist'} (expected)`);
      } else {
        logError(`Pool ${testCase.pair}: unexpected result`);
        allPassed = false;
      }
    } catch (error) {
      logError(`Pool check error for ${testCase.pair}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      allPassed = false;
    }
  }

  return allPassed;
}

async function testQuoteFetching(service: RealRaydiumService): Promise<boolean> {
  logSection('TEST 3: Quote Fetching');

  const testCases: DexQuoteRequest[] = [
    { pair: TradingPair.BTC_USDT, amountIn: 1 },
    { pair: TradingPair.ETH_USDT, amountIn: 10 },
    { pair: TradingPair.BTC_ETH, amountIn: 0.5 },
  ];

  let allPassed = true;

  for (const request of testCases) {
    try {
      logInfo(`Fetching quote for ${request.amountIn} ${request.pair}...`);

      const startTime = Date.now();
      const quote = await service.getQuote(request);
      const duration = Date.now() - startTime;

      logSuccess(`Quote received in ${duration}ms`);
      logInfo(`  Price: ${quote.price.toFixed(4)}`);
      logInfo(`  Fee: ${(quote.fee * 100).toFixed(2)}%`);
      logInfo(`  Estimated output: ${quote.estimatedOutput.toFixed(6)}`);
      logInfo(`  Timestamp: ${quote.timestamp.toISOString()}`);

      // Validation
      if (quote.price <= 0) {
        logError(`  Invalid price: ${quote.price}`);
        allPassed = false;
      }

      if (quote.estimatedOutput <= 0) {
        logError(`  Invalid estimated output: ${quote.estimatedOutput}`);
        allPassed = false;
      }

      if (quote.fee !== 0.0025) {
        logError(`  Incorrect fee: ${quote.fee} (expected 0.0025)`);
        allPassed = false;
      }

    } catch (error) {
      logError(`Quote fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      allPassed = false;
    }
  }

  return allPassed;
}

async function testInvalidQuote(service: RealRaydiumService): Promise<boolean> {
  logSection('TEST 4: Invalid Quote Handling');

  const invalidRequests: DexQuoteRequest[] = [
    { pair: '' as TradingPair, amountIn: 1 },
    { pair: TradingPair.BTC_USDT, amountIn: 0 },
    { pair: TradingPair.BTC_USDT, amountIn: -1 },
  ];

  let allPassed = true;

  for (const request of invalidRequests) {
    try {
      logInfo(`Testing invalid request: pair="${request.pair}", amount=${request.amountIn}`);
      await service.getQuote(request);
      logError('Should have thrown an error for invalid request');
      allPassed = false;
    } catch (error) {
      logSuccess(`Correctly rejected invalid request: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return allPassed;
}

async function testSwapExecution(service: RealRaydiumService): Promise<boolean> {
  logSection('TEST 5: Swap Execution Simulation');

  const testCases = [
    { pair: TradingPair.BTC_USDT, amountIn: 1, expectedPrice: 43000, slippage: 0.01 },
    { pair: TradingPair.ETH_USDT, amountIn: 10, expectedPrice: 2300, slippage: 0.02 },
  ];

  let successCount = 0;
  let failureCount = 0;

  for (const testCase of testCases) {
    try {
      logInfo(`Executing swap: ${testCase.amountIn} ${testCase.pair} @ ${testCase.expectedPrice}`);

      const startTime = Date.now();
      const result = await service.executeSwap(
        testCase.pair,
        testCase.amountIn,
        testCase.expectedPrice,
        testCase.slippage
      );
      const duration = Date.now() - startTime;

      if (result.success) {
        logSuccess(`Swap executed successfully in ${duration}ms`);
        logInfo(`  Transaction: ${result.txHash}`);
        logInfo(`  Executed price: ${result.executedPrice.toFixed(4)}`);
        logInfo(`  Actual output: ${result.actualOutput.toFixed(6)}`);
        logInfo(`  Fee: ${(result.fee * 100).toFixed(2)}%`);
        successCount++;
      } else {
        logError(`Swap failed: ${result.error}`);
        failureCount++;
      }

    } catch (error) {
      logError(`Swap execution error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failureCount++;
    }
  }

  logInfo(`\nSwap results: ${successCount} succeeded, ${failureCount} failed`);
  return successCount > 0; // At least one should succeed
}

async function testInvalidSwap(service: RealRaydiumService): Promise<boolean> {
  logSection('TEST 6: Invalid Swap Handling');

  const invalidSwaps = [
    { pair: '' as TradingPair, amountIn: 1, expectedPrice: 43000, slippage: 0.01, desc: 'empty pair' },
    { pair: TradingPair.BTC_USDT, amountIn: 0, expectedPrice: 43000, slippage: 0.01, desc: 'zero amount' },
    { pair: TradingPair.BTC_USDT, amountIn: -1, expectedPrice: 43000, slippage: 0.01, desc: 'negative amount' },
    { pair: TradingPair.BTC_USDT, amountIn: 1, expectedPrice: 0, slippage: 0.01, desc: 'zero price' },
    { pair: TradingPair.BTC_USDT, amountIn: 1, expectedPrice: -43000, slippage: 0.01, desc: 'negative price' },
    { pair: TradingPair.BTC_USDT, amountIn: 1, expectedPrice: 43000, slippage: -0.01, desc: 'negative slippage' },
    { pair: TradingPair.BTC_USDT, amountIn: 1, expectedPrice: 43000, slippage: 0.6, desc: 'excessive slippage' },
  ];

  let allPassed = true;

  for (const swap of invalidSwaps) {
    try {
      logInfo(`Testing invalid swap (${swap.desc})...`);
      const result = await service.executeSwap(swap.pair, swap.amountIn, swap.expectedPrice, swap.slippage);

      if (!result.success) {
        logSuccess(`Correctly rejected: ${result.error}`);
      } else {
        logError('Should have failed for invalid parameters');
        allPassed = false;
      }
    } catch (error) {
      logSuccess(`Correctly rejected: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return allPassed;
}

async function testRetryLogic(service: RealRaydiumService): Promise<boolean> {
  logSection('TEST 7: Retry Logic');

  logInfo('Testing retry behavior with multiple quote requests...');

  const requests: DexQuoteRequest[] = Array(5).fill(null).map(() => ({
    pair: TradingPair.BTC_USDT,
    amountIn: 1,
  }));

  let successCount = 0;
  let totalDuration = 0;

  for (let i = 0; i < requests.length; i++) {
    try {
      const startTime = Date.now();
      const quote = await service.getQuote(requests[i]);
      const duration = Date.now() - startTime;

      totalDuration += duration;
      successCount++;
      logSuccess(`Request ${i + 1}: ${duration}ms - Price: ${quote.price.toFixed(4)}`);
    } catch (error) {
      logError(`Request ${i + 1} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  const avgDuration = totalDuration / successCount;
  logInfo(`\nAverage request duration: ${avgDuration.toFixed(0)}ms`);
  logInfo(`Success rate: ${successCount}/${requests.length} (${(successCount / requests.length * 100).toFixed(0)}%)`);

  return successCount === requests.length; // All should succeed
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('Raydium Devnet Integration Test Suite');
  console.log('='.repeat(60));

  try {
    // Initialize service
    logInfo('Initializing RealRaydiumService...');
    const service = new RealRaydiumService();
    logSuccess('Service initialized\n');

    // Run tests
    const results: { name: string; passed: boolean }[] = [];

    results.push({ name: 'Connection Health', passed: await testConnectionHealth(service) });
    results.push({ name: 'Pool Existence', passed: await testPoolExistence(service) });
    results.push({ name: 'Quote Fetching', passed: await testQuoteFetching(service) });
    results.push({ name: 'Invalid Quote Handling', passed: await testInvalidQuote(service) });
    results.push({ name: 'Swap Execution', passed: await testSwapExecution(service) });
    results.push({ name: 'Invalid Swap Handling', passed: await testInvalidSwap(service) });
    results.push({ name: 'Retry Logic', passed: await testRetryLogic(service) });

    // Print summary
    logSection('TEST SUMMARY');

    const passedCount = results.filter(r => r.passed).length;
    const totalCount = results.length;

    results.forEach(result => {
      if (result.passed) {
        logSuccess(result.name);
      } else {
        logError(result.name);
      }
    });

    console.log('\n' + '='.repeat(60));
    if (passedCount === totalCount) {
      logSuccess(`All ${totalCount} test groups passed!`);
      console.log('='.repeat(60) + '\n');
      process.exit(0);
    } else {
      logError(`${passedCount}/${totalCount} test groups passed`);
      console.log('='.repeat(60) + '\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n' + '='.repeat(60));
    logError('Fatal error during test execution');
    console.error(error);
    console.error('='.repeat(60) + '\n');
    process.exit(1);
  }
}

// Run tests
main();
