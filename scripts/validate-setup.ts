#!/usr/bin/env tsx
/**
 * Validate Solana devnet setup
 *
 * Usage: npm run validate-setup
 */

import dotenv from 'dotenv';
dotenv.config();

import { validateRealModeSetup, getSecurityChecklist } from '../src/utils/securityValidation';
import { getNetworkFees, getFeeRecommendations } from '../src/utils/feeEstimation';
import { loadKeypairFromEnv, getBalance } from '../src/utils/walletManager';
import { checkRpcHealth, getCurrentSlot } from '../src/config/solana';
import { config } from '../src/config';

async function main() {
  console.log('🔍 Validating Solana Devnet Setup\n');
  console.log('='.repeat(50));

  // Check if mock mode
  if (config.trading.mockMode) {
    console.log('\n⚠️  Mock Mode is ENABLED');
    console.log('   Set MOCK_MODE=false in .env to use real devnet\n');
    console.log('Current configuration is for MOCK mode only.');
    console.log('No further validation needed.\n');
    return;
  }

  console.log('\n✅ Real Mode is ENABLED');
  console.log('   Validating devnet setup...\n');

  let hasErrors = false;

  // 1. Validate complete setup
  console.log('📋 Step 1: Configuration Validation');
  console.log('-'.repeat(50));

  const setupValidation = await validateRealModeSetup();

  if (!setupValidation.valid) {
    console.log(`❌ Validation Failed: ${setupValidation.error}\n`);
    hasErrors = true;
  } else {
    console.log('✅ Configuration is valid\n');

    if (setupValidation.warnings && setupValidation.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      setupValidation.warnings.forEach(w => console.log(`   - ${w}`));
      console.log('');
    }
  }

  // 2. RPC Health Check
  console.log('📋 Step 2: RPC Connection');
  console.log('-'.repeat(50));

  try {
    const isHealthy = await checkRpcHealth();

    if (!isHealthy) {
      console.log('❌ RPC connection failed\n');
      hasErrors = true;
    } else {
      console.log('✅ RPC connection healthy');

      const slot = await getCurrentSlot();
      console.log(`   Current Slot: ${slot}`);

      const fees = await getNetworkFees();
      console.log(`   Network Fees (lamports):`);
      console.log(`     - Min: ${fees.min}`);
      console.log(`     - Avg: ${fees.avg}`);
      console.log(`     - Max: ${fees.max}\n`);
    }
  } catch (error) {
    console.log(`❌ RPC Error: ${error instanceof Error ? error.message : error}\n`);
    hasErrors = true;
  }

  // 3. Wallet Check
  console.log('📋 Step 3: Wallet Validation');
  console.log('-'.repeat(50));

  try {
    const keypair = loadKeypairFromEnv();
    console.log('✅ Keypair loaded successfully');
    console.log(`   Public Key: ${keypair.publicKey.toString()}`);

    const balance = await getBalance(keypair.publicKey);
    console.log(`   Balance: ${balance.toFixed(4)} SOL`);

    if (balance === 0) {
      console.log('\n❌ Zero balance - request airdrop:');
      console.log('   npm run airdrop\n');
      hasErrors = true;
    } else if (balance < 0.1) {
      console.log('\n⚠️  Low balance - consider requesting more:');
      console.log('   npm run airdrop\n');
    } else {
      console.log('✅ Sufficient balance for testing\n');
    }
  } catch (error) {
    console.log(`❌ Wallet Error: ${error instanceof Error ? error.message : error}\n`);
    hasErrors = true;
  }

  // 4. Security Checklist
  console.log('📋 Step 4: Security Checklist');
  console.log('-'.repeat(50));

  const checklist = getSecurityChecklist();
  checklist.forEach(item => {
    const icon = item.status === 'ok' ? '✅' : item.status === 'warning' ? '⚠️ ' : '🚨';
    console.log(`${icon} ${item.item}`);
    console.log(`   ${item.message}`);
  });
  console.log('');

  // 5. Fee Recommendations
  console.log('📋 Step 5: Fee Recommendations');
  console.log('-'.repeat(50));

  try {
    const feeRecs = await getFeeRecommendations();
    console.log('Transaction Fee Estimates:');
    console.log(`   Economy:  ${feeRecs.economy.totalFeeSOL.toFixed(6)} SOL`);
    console.log(`   Standard: ${feeRecs.standard.totalFeeSOL.toFixed(6)} SOL`);
    console.log(`   Fast:     ${feeRecs.fast.totalFeeSOL.toFixed(6)} SOL\n`);
  } catch (error) {
    console.log(`⚠️  Could not fetch fee recommendations\n`);
  }

  // Summary
  console.log('='.repeat(50));
  console.log('\n📊 Validation Summary\n');

  if (hasErrors) {
    console.log('❌ Setup has errors - fix issues above before proceeding\n');
    console.log('💡 Common fixes:');
    console.log('   - Generate keypair: npm run generate-keypair');
    console.log('   - Request airdrop: npm run airdrop');
    console.log('   - Check RPC URL in .env\n');
    process.exit(1);
  } else {
    console.log('✅ All validations passed!');
    console.log('   Your Solana devnet setup is ready.\n');

    console.log('🚀 Next steps:');
    console.log('   - Proceed to Phase 3 (Raydium Integration)');
    console.log('   - Or test with: npm run check-balance\n');

    console.log('🔗 Useful links:');
    if (config.solana) {
      const keypair = loadKeypairFromEnv();
      console.log(`   Explorer: https://explorer.solana.com/address/${keypair.publicKey.toString()}?cluster=devnet`);
    }
    console.log('   Solana Docs: https://docs.solana.com\n');
  }
}

main().catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
