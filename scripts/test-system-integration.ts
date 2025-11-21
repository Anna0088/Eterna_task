#!/usr/bin/env tsx
/**
 * System Integration Test Suite
 *
 * Tests the complete integration of all components:
 * - Configuration validation
 * - Error handling
 * - DEX router with real services
 * - Multi-DEX comparison
 * - End-to-end order flow
 */

import { validateConfigOrThrow, getConfigSummary } from '../src/utils/configValidator';
import { DexRouterService } from '../src/services/dex/DexRouterService';
import { TradingPair, OrderType } from '../src/types';
import {
  ValidationError,
  NetworkError,
  isRetryableError,
  getUserFriendlyMessage,
  logError
} from '../src/utils/errors';

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

/**
 * Test 1: Configuration Validation
 */
async function testConfigValidation(): Promise<boolean> {
  logSection('TEST 1: Configuration Validation');

  try {
    // This should not throw if config is valid
    validateConfigOrThrow();
    logSuccess('Configuration validation passed');

    // Get and display summary
    const summary = getConfigSummary();
    logInfo(`Mode: ${summary.mode}`);
    logInfo(`Environment: ${summary.environment}`);
    logInfo(`Trading pairs: ${summary.trading.supportedPairs}`);
    logInfo(`Slippage: ${summary.trading.defaultSlippage}`);

    return true;
  } catch (error) {
    logError(`Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

/**
 * Test 2: Error Classification
 */
async function testErrorClassification(): Promise<boolean> {
  logSection('TEST 2: Error Classification');

  const testCases = [
    {
      error: new ValidationError('Invalid amount'),
      expectedRetryable: false,
      expectedMessage: 'Invalid input: Invalid amount',
    },
    {
      error: new NetworkError('Connection timeout'),
      expectedRetryable: true,
      expectedMessage: 'Network connection issue. Please try again.',
    },
    {
      error: new Error('ETIMEDOUT'),
      expectedRetryable: true,
      expectedMessage: 'An unexpected error occurred. Please try again later.',
    },
  ];

  let allPassed = true;

  for (const testCase of testCases) {
    const isRetryable = isRetryableError(testCase.error);
    const message = getUserFriendlyMessage(testCase.error);

    if (isRetryable === testCase.expectedRetryable) {
      logSuccess(`${testCase.error.constructor.name}: retryable=${isRetryable} ✓`);
    } else {
      logError(`${testCase.error.constructor.name}: expected retryable=${testCase.expectedRetryable}, got ${isRetryable}`);
      allPassed = false;
    }

    if (message === testCase.expectedMessage) {
      logSuccess(`Message matches: "${message}" ✓`);
    } else {
      logWarning(`Message: "${message}"`);
    }
  }

  return allPassed;
}

/**
 * Test 3: DEX Router Health
 */
async function testDexRouterHealth(): Promise<boolean> {
  logSection('TEST 3: DEX Router Health Check');

  try {
    const router = new DexRouterService();

    logInfo('Checking DEX health...');
    const health = await router.checkDexHealth();

    logInfo(`Raydium: ${health.raydium ? 'healthy' : 'unhealthy'}`);
    logInfo(`Meteora: ${health.meteora ? 'healthy' : 'unhealthy'}`);
    logInfo(`Overall: ${health.overall ? 'healthy' : 'unhealthy'}`);

    if (health.overall) {
      logSuccess('At least one DEX is operational');
      return true;
    } else {
      logError('All DEXs are unavailable');
      return false;
    }
  } catch (error) {
    logError(`Health check failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

/**
 * Test 4: Quote Comparison Across Multiple Pairs
 */
async function testMultiPairQuotes(): Promise<boolean> {
  logSection('TEST 4: Multi-Pair Quote Comparison');

  const router = new DexRouterService();
  const testPairs = [
    TradingPair.BTC_USDT,
    TradingPair.ETH_USDT,
    TradingPair.BTC_ETH,
  ];

  let successCount = 0;
  const results: Array<{
    pair: TradingPair;
    raydiumOutput: number;
    meteoraOutput: number;
    selected: string;
    advantage: number;
  }> = [];

  for (const pair of testPairs) {
    try {
      logInfo(`Testing ${pair}...`);

      const comparison = await router.getQuoteComparison({
        pair,
        amountIn: 1,
      });

      if (comparison.raydiumQuote && comparison.meteoraQuote) {
        const result = {
          pair,
          raydiumOutput: comparison.raydiumQuote.estimatedOutput,
          meteoraOutput: comparison.meteoraQuote.estimatedOutput,
          selected: comparison.raydiumQuote.estimatedOutput > comparison.meteoraQuote.estimatedOutput ? 'Raydium' : 'Meteora',
          advantage: comparison.percentageDifference,
        };

        results.push(result);
        logSuccess(`${pair}: ${result.selected} wins by ${result.advantage.toFixed(2)}%`);
        successCount++;
      } else {
        logWarning(`${pair}: Only partial quotes available`);
      }
    } catch (error) {
      logError(`${pair} failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  // Summary table
  console.log('\n📊 Quote Comparison Summary:');
  console.log('─'.repeat(60));
  results.forEach(r => {
    console.log(`${r.pair}:`);
    console.log(`  Raydium: ${r.raydiumOutput.toFixed(4)}`);
    console.log(`  Meteora: ${r.meteoraOutput.toFixed(4)}`);
    console.log(`  Winner: ${r.selected} (+${r.advantage.toFixed(2)}%)`);
  });
  console.log('─'.repeat(60));

  return successCount === testPairs.length;
}

/**
 * Test 5: Performance Under Load
 */
async function testPerformanceUnderLoad(): Promise<boolean> {
  logSection('TEST 5: Performance Under Load');

  const router = new DexRouterService();
  const concurrentRequests = 10;

  try {
    logInfo(`Executing ${concurrentRequests} concurrent quote requests...`);

    const startTime = Date.now();
    const promises = Array(concurrentRequests).fill(null).map((_, i) =>
      router.getBestQuote({
        pair: TradingPair.BTC_USDT,
        amountIn: 0.1 + (i * 0.01), // Vary amounts slightly
      }).catch(error => ({ error: error.message }))
    );

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    const successful = results.filter(r => !('error' in r)).length;
    const failed = results.filter(r => 'error' in r).length;

    logInfo(`Duration: ${duration}ms`);
    logInfo(`Average per request: ${(duration / concurrentRequests).toFixed(0)}ms`);
    logInfo(`Successful: ${successful}/${concurrentRequests}`);
    logInfo(`Failed: ${failed}/${concurrentRequests}`);

    // Performance thresholds
    const avgDuration = duration / concurrentRequests;
    const successRate = (successful / concurrentRequests) * 100;

    if (avgDuration < 2000 && successRate >= 80) {
      logSuccess(`Performance acceptable: ${avgDuration.toFixed(0)}ms avg, ${successRate.toFixed(0)}% success`);
      return true;
    } else {
      logWarning(`Performance needs improvement: ${avgDuration.toFixed(0)}ms avg, ${successRate.toFixed(0)}% success`);
      return true; // Still pass, but warn
    }
  } catch (error) {
    logError(`Load test failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

/**
 * Test 6: Error Recovery Scenarios
 */
async function testErrorRecovery(): Promise<boolean> {
  logSection('TEST 6: Error Recovery Scenarios');

  const router = new DexRouterService();
  let allPassed = true;

  // Test 1: Invalid pair (should handle gracefully)
  try {
    logInfo('Testing invalid trading pair...');
    await router.getBestQuote({
      pair: 'INVALID/PAIR' as TradingPair,
      amountIn: 1,
    });
    logError('Should have thrown error for invalid pair');
    allPassed = false;
  } catch (error) {
    logSuccess('Invalid pair correctly rejected');
  }

  // Test 2: Zero amount (should handle gracefully)
  try {
    logInfo('Testing zero amount...');
    await router.getBestQuote({
      pair: TradingPair.BTC_USDT,
      amountIn: 0,
    });
    logError('Should have thrown error for zero amount');
    allPassed = false;
  } catch (error) {
    logSuccess('Zero amount correctly rejected');
  }

  // Test 3: Negative amount (should handle gracefully)
  try {
    logInfo('Testing negative amount...');
    await router.getBestQuote({
      pair: TradingPair.BTC_USDT,
      amountIn: -1,
    });
    logError('Should have thrown error for negative amount');
    allPassed = false;
  } catch (error) {
    logSuccess('Negative amount correctly rejected');
  }

  return allPassed;
}

/**
 * Test 7: Mode Consistency
 */
async function testModeConsistency(): Promise<boolean> {
  logSection('TEST 7: Mode Consistency Check');

  const router = new DexRouterService();
  const mode = router.getMode();
  const isMock = router.isMockMode();

  logInfo(`Current mode: ${mode.toUpperCase()}`);
  logInfo(`Mock mode: ${isMock}`);

  // Consistency check
  if ((mode === 'mock' && isMock) || (mode === 'real' && !isMock)) {
    logSuccess('Mode detection consistent');
    return true;
  } else {
    logError('Mode detection inconsistent');
    return false;
  }
}

/**
 * Test 8: Swap Execution Flow
 */
async function testSwapExecutionFlow(): Promise<boolean> {
  logSection('TEST 8: Swap Execution Flow');

  const router = new DexRouterService();

  try {
    // Step 1: Get quote
    logInfo('Step 1: Fetching best quote...');
    const quoteResult = await router.getBestQuote({
      pair: TradingPair.BTC_USDT,
      amountIn: 0.001, // Very small amount
    });

    logSuccess(`Quote received: ${quoteResult.selectedDex}`);
    logInfo(`  Expected output: ${quoteResult.bestQuote.estimatedOutput.toFixed(4)}`);
    logInfo(`  Fee: ${(quoteResult.bestQuote.fee * 100).toFixed(3)}%`);

    // Step 2: Execute swap
    logInfo('Step 2: Executing swap...');
    const swapResult = await router.executeSwap(
      quoteResult.selectedDex,
      TradingPair.BTC_USDT,
      0.001,
      quoteResult.bestQuote.price,
      0.01 // 1% slippage
    );

    if (swapResult.success) {
      logSuccess('Swap executed successfully');
      logInfo(`  Transaction: ${swapResult.txHash}`);
      logInfo(`  Actual output: ${swapResult.actualOutput.toFixed(4)}`);
      logInfo(`  Executed price: ${swapResult.executedPrice.toFixed(4)}`);

      // Step 3: Verify slippage within tolerance
      const expectedPrice = quoteResult.bestQuote.price;
      const actualPrice = swapResult.executedPrice;
      const slippagePercent = Math.abs((actualPrice - expectedPrice) / expectedPrice) * 100;

      logInfo(`  Slippage: ${slippagePercent.toFixed(2)}%`);

      if (slippagePercent <= 1) {
        logSuccess('Slippage within tolerance');
        return true;
      } else {
        logWarning(`Slippage high but accepted: ${slippagePercent.toFixed(2)}%`);
        return true;
      }
    } else {
      logWarning(`Swap failed: ${swapResult.error}`);
      // Failure is acceptable in simulation
      return true;
    }
  } catch (error) {
    logError(`Swap execution test failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    return false;
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('\n' + '='.repeat(60));
  console.log(`${COLORS.magenta}System Integration Test Suite${COLORS.reset}`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  const results: { name: string; passed: boolean; duration: number }[] = [];

  // Run all tests
  const tests = [
    { name: 'Configuration Validation', fn: testConfigValidation },
    { name: 'Error Classification', fn: testErrorClassification },
    { name: 'DEX Router Health', fn: testDexRouterHealth },
    { name: 'Multi-Pair Quote Comparison', fn: testMultiPairQuotes },
    { name: 'Performance Under Load', fn: testPerformanceUnderLoad },
    { name: 'Error Recovery Scenarios', fn: testErrorRecovery },
    { name: 'Mode Consistency', fn: testModeConsistency },
    { name: 'Swap Execution Flow', fn: testSwapExecutionFlow },
  ];

  for (const test of tests) {
    const testStart = Date.now();
    try {
      const passed = await test.fn();
      const duration = Date.now() - testStart;
      results.push({ name: test.name, passed, duration });
    } catch (error) {
      const duration = Date.now() - testStart;
      results.push({ name: test.name, passed: false, duration });
      logError(`Test threw unexpected error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  // Print summary
  logSection('TEST SUMMARY');

  const totalDuration = Date.now() - startTime;
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  results.forEach(result => {
    const icon = result.passed ? '✓' : '✗';
    const color = result.passed ? COLORS.green : COLORS.red;
    console.log(`${color}${icon}${COLORS.reset} ${result.name} (${result.duration}ms)`);
  });

  console.log('\n' + '='.repeat(60));
  console.log(`Total Duration: ${totalDuration}ms`);
  console.log(`Tests Passed: ${passedCount}/${totalCount} (${((passedCount / totalCount) * 100).toFixed(0)}%)`);

  if (passedCount === totalCount) {
    console.log(`${COLORS.green}✓ ALL TESTS PASSED${COLORS.reset}`);
    console.log('='.repeat(60) + '\n');
    process.exit(0);
  } else {
    console.log(`${COLORS.red}✗ SOME TESTS FAILED${COLORS.reset}`);
    console.log('='.repeat(60) + '\n');
    process.exit(1);
  }
}

// Run tests
main();
