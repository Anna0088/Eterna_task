import { Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { getSolanaConnection } from '../config/solana';

/**
 * Generate a new Solana keypair
 */
export function generateKeypair(): Keypair {
  return Keypair.generate();
}

/**
 * Load keypair from base64 encoded private key
 */
export function loadKeypairFromBase64(privateKeyBase64: string): Keypair {
  try {
    const privateKeyBuffer = Buffer.from(privateKeyBase64, 'base64');
    return Keypair.fromSecretKey(privateKeyBuffer);
  } catch (error) {
    throw new Error(`Failed to load keypair from base64: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load keypair from bs58 encoded private key
 */
export function loadKeypairFromBs58(privateKeyBs58: string): Keypair {
  try {
    const privateKeyBuffer = bs58.decode(privateKeyBs58);
    return Keypair.fromSecretKey(privateKeyBuffer);
  } catch (error) {
    throw new Error(`Failed to load keypair from bs58: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Load keypair from environment variable
 * Supports both base64 and bs58 formats
 */
export function loadKeypairFromEnv(): Keypair {
  const privateKey = process.env.SOLANA_PRIVATE_KEY;

  if (!privateKey) {
    throw new Error('SOLANA_PRIVATE_KEY environment variable not set');
  }

  // Try base64 first (recommended format)
  try {
    return loadKeypairFromBase64(privateKey);
  } catch (base64Error) {
    // Try bs58 as fallback
    try {
      return loadKeypairFromBs58(privateKey);
    } catch (bs58Error) {
      throw new Error('SOLANA_PRIVATE_KEY is neither valid base64 nor bs58 format');
    }
  }
}

/**
 * Export keypair to base64 (for storage)
 */
export function exportKeypairToBase64(keypair: Keypair): string {
  return Buffer.from(keypair.secretKey).toString('base64');
}

/**
 * Export keypair to bs58 (alternative format)
 */
export function exportKeypairToBs58(keypair: Keypair): string {
  return bs58.encode(keypair.secretKey);
}

/**
 * Get SOL balance for a public key
 */
export async function getBalance(publicKey: PublicKey): Promise<number> {
  const connection = getSolanaConnection();
  const lamports = await connection.getBalance(publicKey);
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Get SOL balance for current wallet (from env)
 */
export async function getWalletBalance(): Promise<number> {
  const keypair = loadKeypairFromEnv();
  return await getBalance(keypair.publicKey);
}

/**
 * Validate that a string is a valid Solana public key
 */
export function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Convert lamports to SOL
 */
export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Convert SOL to lamports
 */
export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}

/**
 * Check if wallet has sufficient SOL for fees
 */
export async function hasSufficientSol(publicKey: PublicKey, minSol: number = 0.1): Promise<boolean> {
  const balance = await getBalance(publicKey);
  return balance >= minSol;
}
