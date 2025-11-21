#!/usr/bin/env tsx
/**
 * Request SOL airdrop on Solana devnet
 *
 * Usage: npm run airdrop [amount]
 * Example: npm run airdrop 2
 */

import dotenv from 'dotenv';
dotenv.config();

import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getSolanaConnection } from '../src/config/solana';
import { loadKeypairFromEnv, getBalance } from '../src/utils/walletManager';

async function requestAirdrop(amountSol: number = 2): Promise<string> {
  const connection = getSolanaConnection();
  const keypair = loadKeypairFromEnv();

  console.log(`💰 Requesting ${amountSol} SOL airdrop...`);
  console.log(`   Wallet: ${keypair.publicKey.toString()}`);

  const lamports = amountSol * LAMPORTS_PER_SOL;
  const signature = await connection.requestAirdrop(keypair.publicKey, lamports);

  console.log(`   Transaction: ${signature}`);
  console.log(`   Confirming...`);

  await connection.confirmTransaction(signature);

  return signature;
}

async function main() {
  try {
    // Parse amount from command line args
    const args = process.argv.slice(2);
    const amount = args.length > 0 ? parseFloat(args[0]) : 2;

    if (isNaN(amount) || amount <= 0 || amount > 5) {
      console.error('❌ Invalid amount. Must be between 0 and 5 SOL');
      process.exit(1);
    }

    console.log('🪂 Solana Devnet Airdrop\n');

    // Check current balance
    const keypair = loadKeypairFromEnv();
    const balanceBefore = await getBalance(keypair.publicKey);
    console.log(`📊 Current balance: ${balanceBefore.toFixed(4)} SOL\n`);

    // Request airdrop
    const signature = await requestAirdrop(amount);

    // Check new balance
    const balanceAfter = await getBalance(keypair.publicKey);
    const received = balanceAfter - balanceBefore;

    console.log(`\n✅ Airdrop successful!`);
    console.log(`   Received: ${received.toFixed(4)} SOL`);
    console.log(`   New balance: ${balanceAfter.toFixed(4)} SOL`);
    console.log(`   Transaction: ${signature}\n`);

    console.log(`🔗 View on Solana Explorer:`);
    console.log(`   https://explorer.solana.com/tx/${signature}?cluster=devnet\n`);
  } catch (error) {
    console.error('❌ Airdrop failed:', error instanceof Error ? error.message : error);
    console.log('\n💡 Troubleshooting:');
    console.log('   • Make sure SOLANA_PRIVATE_KEY is set in .env');
    console.log('   • Devnet airdrops are rate-limited (max 2 SOL per request)');
    console.log('   • Wait a few minutes between airdrop requests');
    console.log('   • Try a smaller amount (e.g., 1 SOL)');
    process.exit(1);
  }
}

main();
