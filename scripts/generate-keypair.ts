#!/usr/bin/env tsx
/**
 * Generate a new Solana keypair for development/testing
 *
 * Usage: npm run generate-keypair
 */

import { generateKeypair, exportKeypairToBase64, exportKeypairToBs58 } from '../src/utils/walletManager';

function main() {
  console.log('🔑 Generating new Solana keypair...\n');

  const keypair = generateKeypair();

  console.log('✅ Keypair generated successfully!\n');
  console.log('📋 Public Key (Wallet Address):');
  console.log(`   ${keypair.publicKey.toString()}\n`);

  console.log('🔐 Private Key (Base64 - Recommended):');
  console.log(`   ${exportKeypairToBase64(keypair)}\n`);

  console.log('🔐 Private Key (BS58 - Alternative):');
  console.log(`   ${exportKeypairToBs58(keypair)}\n`);

  console.log('⚙️  Add to your .env file:');
  console.log(`   SOLANA_PRIVATE_KEY=${exportKeypairToBase64(keypair)}\n`);

  console.log('⚠️  SECURITY WARNINGS:');
  console.log('   • NEVER commit private keys to git');
  console.log('   • NEVER share private keys with anyone');
  console.log('   • Use this keypair ONLY for devnet/testing');
  console.log('   • For production, use hardware wallet or secure key management\n');

  console.log('📝 Next steps:');
  console.log('   1. Copy the private key to your .env file');
  console.log('   2. Request devnet SOL: npm run airdrop');
  console.log('   3. Check balance: npm run check-balance\n');
}

main();
