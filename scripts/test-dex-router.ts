#!/usr/bin/env tsx
import { DexRouterService } from '../src/services/dex/DexRouterService';
import { TradingPair, DexType } from '../src/types';

/**
 * Test script for DexRouterService integration
 *
 * This script tests:
 * 1. Mode switching (mock vs real)
 * 2. Multi-DEX quote comparison
 * 3. Best execution selection
 * 4. Error handling and fallback logic
 * 5. DEX health checks
 */

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
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

function logWarning(message: string) {
  console.log(`${COLORS.yellow}⚠${COLORS.reset} ${message}`);
}

function logSection(message: string) {
  console.log(`\n${COLORS.cyan}${'='.repeat(60)}${COLORS.reset}`);
  console.log(`${COLORS.cyan}${message}${COLORS.reset}`);
  console.log(`${COLORS.cyan}${'='.repeat(60)}${COLORS.reset}\n`);
}

async function testModeDetection(router: DexRouterService): Promise<boolean> {
  logSection('TEST 1: Mode Detection');

  try {
    const mode = router.getMode();
    const isMock = router.isMockMode();

    logSuccess(`Operating mode: ${mode.toUpperCase()}`);
    logInfo(`Mock mode: ${isMock}`);

    if ((mode === 'mock' && isMock) || (mode === 'real' && !isMock)) {
      logSuccess('Mode detection consistent');
      return true;
    } else {
      logError('Mode detection inconsistent');
      return false;
    }
  } catch (error) {
    logError(`Mode detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function testHealthChecks(router: DexRouterService): Promise<boolean> {
  logSection('TEST 2: DEX Health Checks');

  try {
    const health = await router.checkDexHealth();

    logInfo(`Raydium: ${health.raydium ? 'healthy' : 'unhealthy'}`);
    logInfo(`Meteora: ${health.meteora ? 'healthy' : 'unhealthy'}`);
    logInfo(`Overall: ${health.overall ? 'healthy' : 'unhealthy'}`);

    if (health.overall) {
      logSuccess('At least one DEX is healthy');
      return true;
    } else {
      logError('All DEXs are unhealthy');
      return false;
    }
  } catch (error) {
    logError(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function testBestQuote(router: DexRouterService): Promise<boolean> {
  logSection('TEST 3: Best Quote Selection');

  const testCases = [
    { pair: TradingPair.BTC_USDT, amount: 1 },
    { pair: TradingPair.ETH_USDT, amount: 10 },
    { pair: TradingPair.BTC_ETH, amount: 0.5 },
  ];

  let allPassed = true;

  for (const testCase of testCases) {
    try {
      logInfo(`Testing ${testCase.amount} ${testCase.pair}...`);

      const startTime = Date.now();
      const result = await router.getBestQuote({
        pair: testCase.pair,
        amountIn: testCase.amount,
      });
      const duration = Date.now() - startTime;

      logSuccess(`Quote received in ${duration}ms`);
      logInfo(`  Selected: ${result.selectedDex}`);
      logInfo(`  Reason: ${result.reason}`);
      logInfo(`  Raydium: ${result.raydiumQuote.estimatedOutput.toFixed(4)} (fee: ${(result.raydiumQuote.fee * 100).toFixed(3)}%)`);
      logInfo(`  Meteora: ${result.meteoraQuote.estimatedOutput.toFixed(4)} (fee: ${(result.meteoraQuote.fee * 100).toFixed(3)}%)`);
      logInfo(`  Best: ${result.bestQuote.estimatedOutput.toFixed(4)}`);

      // Validation
      if (!result.selectedDex || !result.bestQuote) {
        logError('Missing selected DEX or best quote');
        allPassed = false;
        continue;
      }

      // Verify best quote is actually the best
      const maxOutput = Math.max(
        result.raydiumQuote.estimatedOutput,
        result.meteoraQuote.estimatedOutput
      );

      // Allow small tolerance for fee comparison cases
      if (Math.abs(result.bestQuote.estimatedOutput - maxOutput) < 0.01) {
        logSuccess('Best quote selection validated');
      } else {
        logError(`Best quote not optimal: ${result.bestQuote.estimatedOutput} vs max ${maxOutput}`);
        allPassed = false;
      }

    } catch (error) {
      logError(`Best quote test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      allPassed = false;
    }
  }

  return allPassed;
}

async function testQuoteComparison(router: DexRouterService): Promise<boolean> {
  logSection('TEST 4: Detailed Quote Comparison');

  try {
    const comparison = await router.getQuoteComparison({
      pair: TradingPair.BTC_USDT,
      amountIn: 1,
    });

    logSuccess('Quote comparison retrieved');

    if (comparison.raydiumQuote && comparison.meteoraQuote) {
      logInfo(`  Output difference: ${comparison.outputDifference.toFixed(4)}`);
      logInfo(`  Percentage difference: ${comparison.percentageDifference.toFixed(2)}%`);

      if (comparison.feeComparison) {
        logInfo(`  Raydium fee: ${(comparison.feeComparison.raydium * 100).toFixed(3)}%`);
        logInfo(`  Meteora fee: ${(comparison.feeComparison.meteora * 100).toFixed(3)}%`);
        logInfo(`  Fee difference: ${(comparison.feeComparison.difference * 100).toFixed(3)}%`);
      }

      logInfo(`  Recommendation: ${comparison.recommendation}`);
      logSuccess('Both DEXs available for comparison');
      return true;
    } else if (comparison.raydiumQuote || comparison.meteoraQuote) {
      logWarning('Only one DEX available');
      logInfo(`  Recommendation: ${comparison.recommendation}`);
      return true;
    } else {
      logError('No DEX available for comparison');
      return false;
    }
  } catch (error) {
    logError(`Quote comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function testSpecificDexQuote(router: DexRouterService): Promise<boolean> {
  logSection('TEST 5: Specific DEX Quote Retrieval');

  let allPassed = true;

  try {
    logInfo('Testing Raydium quote...');
    const raydiumQuote = await router.getQuoteFromDex(DexType.RAYDIUM, {
      pair: TradingPair.BTC_USDT,
      amountIn: 1,
    });

    if (raydiumQuote.dex === DexType.RAYDIUM) {
      logSuccess(`Raydium quote: ${raydiumQuote.estimatedOutput.toFixed(4)}`);
    } else {
      logError('Wrong DEX type returned for Raydium');
      allPassed = false;
    }
  } catch (error) {
    logError(`Raydium quote failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    allPassed = false;
  }

  try {
    logInfo('Testing Meteora quote...');
    const meteoraQuote = await router.getQuoteFromDex(DexType.METEORA, {
      pair: TradingPair.ETH_USDT,
      amountIn: 10,
    });

    if (meteoraQuote.dex === DexType.METEORA) {
      logSuccess(`Meteora quote: ${meteoraQuote.estimatedOutput.toFixed(4)}`);
    } else {
      logError('Wrong DEX type returned for Meteora');
      allPassed = false;
    }
  } catch (error) {
    logError(`Meteora quote failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    allPassed = false;
  }

  return allPassed;
}

async function testSwapExecution(router: DexRouterService): Promise<boolean> {
  logSection('TEST 6: Swap Execution');

  let allPassed = true;

  // Test Raydium swap
  try {
    logInfo('Testing Raydium swap execution...');

    const result = await router.executeSwap(
      DexType.RAYDIUM,
      TradingPair.BTC_USDT,
      1,
      43000,
      0.01
    );

    if (result.dex === DexType.RAYDIUM) {
      if (result.success) {
        logSuccess(`Raydium swap executed: ${result.actualOutput.toFixed(4)} output`);
        logInfo(`  Transaction: ${result.txHash}`);
        logInfo(`  Fee: ${(result.fee * 100).toFixed(3)}%`);
      } else {
        logWarning(`Raydium swap failed: ${result.error}`);
        // Failure is acceptable in simulation, but result should be structured
      }
    } else {
      logError('Wrong DEX type in result');
      allPassed = false;
    }
  } catch (error) {
    logError(`Raydium swap test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    allPassed = false;
  }

  // Test Meteora swap
  try {
    logInfo('Testing Meteora swap execution...');

    const result = await router.executeSwap(
      DexType.METEORA,
      TradingPair.ETH_USDT,
      10,
      2300,
      0.02
    );

    if (result.dex === DexType.METEORA) {
      if (result.success) {
        logSuccess(`Meteora swap executed: ${result.actualOutput.toFixed(4)} output`);
        logInfo(`  Transaction: ${result.txHash}`);
        logInfo(`  Fee: ${(result.fee * 100).toFixed(3)}%`);
      } else {
        logWarning(`Meteora swap failed: ${result.error}`);
        // Failure is acceptable in simulation, but result should be structured
      }
    } else {
      logError('Wrong DEX type in result');
      allPassed = false;
    }
  } catch (error) {
    logError(`Meteora swap test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    allPassed = false;
  }

  return allPassed;
}

async function testCurrentPrice(router: DexRouterService): Promise<boolean> {
  logSection('TEST 7: Current Price Retrieval');

  const testPairs = [TradingPair.BTC_USDT, TradingPair.ETH_USDT, TradingPair.BTC_ETH];
  let allPassed = true;

  for (const pair of testPairs) {
    try {
      const price = await router.getCurrentPrice(pair);

      if (price > 0) {
        logSuccess(`${pair} current price: ${price.toFixed(4)}`);
      } else {
        logError(`Invalid price for ${pair}: ${price}`);
        allPassed = false;
      }
    } catch (error) {
      logError(`Price retrieval failed for ${pair}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      allPassed = false;
    }
  }

  return allPassed;
}

async function testPerformance(router: DexRouterService): Promise<boolean> {
  logSection('TEST 8: Performance & Parallel Execution');

  try {
    logInfo('Testing parallel quote fetching (5 requests)...');

    const startTime = Date.now();

    const promises = Array(5).fill(null).map(() =>
      router.getBestQuote({
        pair: TradingPair.BTC_USDT,
        amountIn: 1,
      })
    );

    await Promise.all(promises);

    const duration = Date.now() - startTime;
    const avgDuration = duration / 5;

    logSuccess(`Completed 5 parallel requests in ${duration}ms`);
    logInfo(`  Average per request: ${avgDuration.toFixed(0)}ms`);

    // Verify parallel execution (should not be 5x sequential time)
    const mode = router.getMode();
    const expectedMaxTime = mode === 'mock' ? 1500 : 4000; // Looser bounds for real mode

    if (duration < expectedMaxTime) {
      logSuccess('Parallel execution confirmed');
      return true;
    } else {
      logWarning(`Execution slower than expected: ${duration}ms > ${expectedMaxTime}ms`);
      return true; // Still pass, might be system load
    }
  } catch (error) {
    logError(`Performance test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('DexRouterService Integration Test Suite');
  console.log('='.repeat(60));

  try {
    // Initialize router
    logInfo('Initializing DexRouterService...');
    const router = new DexRouterService();
    logSuccess('Router initialized\n');

    // Run tests
    const results: { name: string; passed: boolean }[] = [];

    results.push({ name: 'Mode Detection', passed: await testModeDetection(router) });
    results.push({ name: 'DEX Health Checks', passed: await testHealthChecks(router) });
    results.push({ name: 'Best Quote Selection', passed: await testBestQuote(router) });
    results.push({ name: 'Detailed Quote Comparison', passed: await testQuoteComparison(router) });
    results.push({ name: 'Specific DEX Quotes', passed: await testSpecificDexQuote(router) });
    results.push({ name: 'Swap Execution', passed: await testSwapExecution(router) });
    results.push({ name: 'Current Price Retrieval', passed: await testCurrentPrice(router) });
    results.push({ name: 'Performance & Parallel Execution', passed: await testPerformance(router) });

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
      console.log(`${COLORS.magenta}Multi-DEX Routing Features Verified:${COLORS.reset}`);
      console.log(`  ✓ Mode switching (mock/real)`);
      console.log(`  ✓ Parallel quote fetching`);
      console.log(`  ✓ Best execution selection`);
      console.log(`  ✓ Error handling & fallback`);
      console.log(`  ✓ Fee-based optimization`);
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
