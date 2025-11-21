import {
  Transaction,
  TransactionInstruction,
  PublicKey,
  Keypair,
  sendAndConfirmTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import { getSolanaConnection, solanaConfig } from '../config/solana';
import { config } from '../config';

/**
 * Add compute budget instructions to a transaction
 * This helps with priority fees and ensures transaction goes through
 */
export function addComputeBudgetInstructions(
  instructions: TransactionInstruction[],
  computeUnitPrice?: number,
  computeUnitLimit?: number
): TransactionInstruction[] {
  const budgetInstructions: TransactionInstruction[] = [];

  // Set compute unit limit
  if (computeUnitLimit) {
    budgetInstructions.push(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: computeUnitLimit,
      })
    );
  }

  // Set compute unit price (priority fee)
  if (computeUnitPrice) {
    budgetInstructions.push(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: computeUnitPrice,
      })
    );
  }

  return [...budgetInstructions, ...instructions];
}

/**
 * Build a transaction with instructions
 */
export async function buildTransaction(
  instructions: TransactionInstruction[],
  payer: PublicKey,
  addComputeBudget = true
): Promise<Transaction> {
  const connection = getSolanaConnection();

  // Add compute budget if requested
  const finalInstructions = addComputeBudget
    ? addComputeBudgetInstructions(
        instructions,
        config.trading.computeUnitPrice,
        config.trading.computeUnitLimit
      )
    : instructions;

  // Create transaction
  const transaction = new Transaction();
  transaction.add(...finalInstructions);

  // Get recent blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payer;

  return transaction;
}

/**
 * Sign a transaction with a keypair
 */
export function signTransaction(transaction: Transaction, signer: Keypair): Transaction {
  transaction.sign(signer);
  return transaction;
}

/**
 * Send and confirm a transaction
 */
export async function sendAndConfirmTransactionSafe(
  transaction: Transaction,
  signers: Keypair[]
): Promise<string> {
  const connection = getSolanaConnection();

  try {
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      signers,
      {
        commitment: solanaConfig.commitment,
        maxRetries: solanaConfig.maxRetries,
      }
    );

    return signature;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Transaction failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Simulate a transaction before sending
 */
export async function simulateTransaction(
  transaction: Transaction,
  includeAccounts = false
): Promise<{
  success: boolean;
  logs: string[];
  unitsConsumed?: number;
  error?: string;
}> {
  const connection = getSolanaConnection();

  try {
    const simulation = await connection.simulateTransaction(transaction, undefined, includeAccounts);

    if (simulation.value.err) {
      return {
        success: false,
        logs: simulation.value.logs || [],
        error: JSON.stringify(simulation.value.err),
      };
    }

    return {
      success: true,
      logs: simulation.value.logs || [],
      unitsConsumed: simulation.value.unitsConsumed,
    };
  } catch (error) {
    return {
      success: false,
      logs: [],
      error: error instanceof Error ? error.message : 'Unknown simulation error',
    };
  }
}

/**
 * Wait for transaction confirmation with timeout
 */
export async function confirmTransactionWithTimeout(
  signature: string,
  timeout = solanaConfig.confirmTimeout
): Promise<boolean> {
  const connection = getSolanaConnection();
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const status = await connection.getSignatureStatus(signature);

    if (status?.value?.confirmationStatus === 'confirmed' ||
        status?.value?.confirmationStatus === 'finalized') {
      return true;
    }

    if (status?.value?.err) {
      throw new Error(`Transaction failed: ${JSON.stringify(status.value.err)}`);
    }

    // Wait 1 second before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error(`Transaction confirmation timeout after ${timeout}ms`);
}

/**
 * Get transaction details
 */
export async function getTransaction(signature: string) {
  const connection = getSolanaConnection();
  return await connection.getTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  });
}

/**
 * Parse transaction logs for errors
 */
export function parseTransactionLogs(logs: string[]): {
  success: boolean;
  error?: string;
  programLogs: string[];
} {
  const programLogs: string[] = [];
  let error: string | undefined;

  for (const log of logs) {
    if (log.includes('Program log:')) {
      programLogs.push(log);
    }
    if (log.includes('Error:') || log.includes('failed:')) {
      error = log;
    }
  }

  return {
    success: !error,
    error,
    programLogs,
  };
}

/**
 * Estimate transaction fee
 */
export async function estimateTransactionFee(
  instructions: TransactionInstruction[],
  payer: PublicKey
): Promise<number> {
  const connection = getSolanaConnection();

  // Build transaction
  const transaction = await buildTransaction(instructions, payer, true);

  // Get fee for message
  const fee = await connection.getFeeForMessage(
    transaction.compileMessage(),
    solanaConfig.commitment
  );

  return fee.value || 0;
}

/**
 * Check if a transaction signature is valid
 */
export function isValidSignature(signature: string): boolean {
  // Solana signatures are 88 characters (base58 encoded)
  return /^[1-9A-HJ-NP-Za-km-z]{87,88}$/.test(signature);
}

/**
 * Get Solana Explorer URL for transaction
 */
export function getExplorerUrl(signature: string, cluster: 'devnet' | 'mainnet-beta' = 'devnet'): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
}
