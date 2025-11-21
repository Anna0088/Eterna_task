#!/usr/bin/env tsx
/**
 * Check SOL balance on Solana devnet
 *
 * Usage: npm run check-balance
 */

import dotenv from 'dotenv';
dotenv.config();

import { loadKeypairFromEnv, getBalance } from '../src/utils/walletManager';
import { getSolanaConnection, checkRpcHealth } from '../src/config/solana';

async function main() {
  try {
    console.log('💼 Checking Wallet Balance\n');

    // Check RPC connection
    console.log('🔌 Checking RPC connection...');
    const isHealthy = await checkRpcHealth();

    if (!isHealthy) {
      console.error('❌ RPC connection failed');
      console.log('   Check SOLANA_RPC_URL in your .env file\n');
      process.exit(1);
    }

    console.log('✅ RPC connection healthy\n');

    // Load wallet
    const keypair = loadKeypairFromEnv();
    console.log(`📍 Wallet Address:`);
    console.log(`   ${keypair.publicKey.toString()}\n`);

    // Get balance
    const balance = await getBalance(keypair.publicKey);
    console.log(`💰 Balance: ${balance.toFixed(4)} SOL\n`);

    // Balance warnings
    if (balance === 0) {
      console.log('⚠️  Zero balance - request airdrop:');
      console.log('   npm run airdrop\n');
    } else if (balance < 0.1) {
      console.log('⚠️  Low balance - consider requesting more:');
      console.log('   npm run airdrop\n');
    } else {
      console.log('✅ Sufficient balance for testing\n');
    }

    // Additional info
    const connection = getSolanaConnection();
    const slot = await connection.getSlot();

    console.log(`📊 Network Info:`);
    console.log(`   Network: Devnet`);
    console.log(`   Current Slot: ${slot}`);
    console.log(`\n🔗 View on Explorer:`);
    console.log(`   https://explorer.solana.com/address/${keypair.publicKey.toString()}?cluster=devnet\n`);
  } catch (error) {
    console.error('❌ Error checking balance:', error instanceof Error ? error.message : error);
    console.log('\n💡 Make sure SOLANA_PRIVATE_KEY is set in your .env file\n');
    process.exit(1);
  }
}

main();
