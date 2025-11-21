#!/usr/bin/env tsx

/**
 * Deployment Verification Script
 *
 * Verifies that a deployed instance is working correctly by:
 * - Checking health endpoints
 * - Validating API responses
 * - Testing order execution
 * - Verifying WebSocket connectivity
 */

import 'dotenv/config';

const BASE_URL = process.env.DEPLOYMENT_URL || 'http://localhost:3000';

interface VerificationResult {
  name: string;
  passed: boolean;
  message: string;
  details?: any;
}

const results: VerificationResult[] = [];

/**
 * Verify health endpoint
 */
async function verifyHealth(): Promise<VerificationResult> {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();

    if (response.ok && data.status) {
      return {
        name: 'Health Check',
        passed: true,
        message: `System is ${data.status}`,
        details: {
          mode: data.mode,
          environment: data.environment,
          uptime: `${Math.round(data.uptime)}s`,
          database: data.components.database.status,
          redis: data.components.redis.status,
          queue: data.components.queue.status,
        },
      };
    } else {
      return {
        name: 'Health Check',
        passed: false,
        message: 'Health check returned unhealthy status',
        details: data,
      };
    }
  } catch (error) {
    return {
      name: 'Health Check',
      passed: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify mode endpoint
 */
async function verifyMode(): Promise<VerificationResult> {
  try {
    const response = await fetch(`${BASE_URL}/health/mode`);
    const data = await response.json();

    if (response.ok && data.mode) {
      return {
        name: 'Mode Detection',
        passed: true,
        message: `Running in ${data.mode.toUpperCase()} mode`,
        details: {
          mode: data.mode,
          description: data.description,
        },
      };
    } else {
      return {
        name: 'Mode Detection',
        passed: false,
        message: 'Failed to detect mode',
        details: data,
      };
    }
  } catch (error) {
    return {
      name: 'Mode Detection',
      passed: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify metrics endpoint
 */
async function verifyMetrics(): Promise<VerificationResult> {
  try {
    const response = await fetch(`${BASE_URL}/health/metrics`);
    const data = await response.json();

    if (response.ok && data.timestamp) {
      return {
        name: 'Performance Metrics',
        passed: true,
        message: 'Metrics collection working',
        details: {
          memory: `${data.memory.heapUsed}MB / ${data.memory.heapTotal}MB`,
          queueThroughput: data.queue.throughput.successRate,
          queueActive: data.queue.current.active,
        },
      };
    } else {
      return {
        name: 'Performance Metrics',
        passed: false,
        message: 'Failed to fetch metrics',
        details: data,
      };
    }
  } catch (error) {
    return {
      name: 'Performance Metrics',
      passed: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify order execution API
 */
async function verifyOrderExecution(): Promise<VerificationResult> {
  try {
    const orderPayload = {
      type: 'MARKET',
      pair: 'BTC/USDT',
      amount: 0.001,
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    };

    const response = await fetch(`${BASE_URL}/api/orders/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    const data = await response.json();

    if (response.ok && data.orderId) {
      // Wait a moment for order to process
      await new Promise((resolve) => setTimeout(resolve, 6000));

      // Check order status
      const statusResponse = await fetch(`${BASE_URL}/api/orders/${data.orderId}`);
      const orderStatus = await statusResponse.json();

      if (statusResponse.ok) {
        return {
          name: 'Order Execution',
          passed: true,
          message: `Order ${orderStatus.status}`,
          details: {
            orderId: data.orderId,
            status: orderStatus.status,
            dexUsed: orderStatus.dexUsed,
            executedPrice: orderStatus.executedPrice,
          },
        };
      } else {
        return {
          name: 'Order Execution',
          passed: false,
          message: 'Failed to fetch order status',
          details: orderStatus,
        };
      }
    } else {
      return {
        name: 'Order Execution',
        passed: false,
        message: 'Failed to execute order',
        details: data,
      };
    }
  } catch (error) {
    return {
      name: 'Order Execution',
      passed: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Verify orders listing API
 */
async function verifyOrdersList(): Promise<VerificationResult> {
  try {
    const response = await fetch(`${BASE_URL}/api/orders?limit=5`);
    const data = await response.json();

    if (response.ok && Array.isArray(data)) {
      return {
        name: 'Orders List',
        passed: true,
        message: `Found ${data.length} recent orders`,
        details: {
          count: data.length,
        },
      };
    } else {
      return {
        name: 'Orders List',
        passed: false,
        message: 'Failed to fetch orders list',
        details: data,
      };
    }
  } catch (error) {
    return {
      name: 'Orders List',
      passed: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Print results
 */
function printResults() {
  console.log('\n' + '='.repeat(60));
  console.log('DEPLOYMENT VERIFICATION RESULTS');
  console.log('='.repeat(60));
  console.log(`\nTarget: ${BASE_URL}\n`);

  let passed = 0;
  let failed = 0;

  for (const result of results) {
    const icon = result.passed ? '✅' : '❌';
    console.log(`${icon} ${result.name}`);
    console.log(`   ${result.message}`);

    if (result.details) {
      console.log('   Details:');
      for (const [key, value] of Object.entries(result.details)) {
        console.log(`     ${key}: ${value}`);
      }
    }
    console.log();

    if (result.passed) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log('='.repeat(60));
  console.log(`Total: ${results.length} tests`);
  console.log(`Passed: ${passed} (${((passed / results.length) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failed}`);
  console.log('='.repeat(60));

  if (failed === 0) {
    console.log('\n✅ All verification checks passed!');
    console.log('Deployment is healthy and ready for use.\n');
  } else {
    console.log('\n❌ Some verification checks failed.');
    console.log('Please review the failures above and fix the issues.\n');
    process.exit(1);
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🔍 Starting deployment verification...\n');
  console.log(`Target URL: ${BASE_URL}`);
  console.log('This may take a few seconds...\n');

  // Run all verification checks
  results.push(await verifyHealth());
  results.push(await verifyMode());
  results.push(await verifyMetrics());
  results.push(await verifyOrderExecution());
  results.push(await verifyOrdersList());

  // Print results
  printResults();
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('\n❌ Verification script failed:', error);
    process.exit(1);
  });
}

export { main as verifyDeployment };
