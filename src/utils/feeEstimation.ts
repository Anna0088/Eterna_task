import { PublicKey, LAMPORTS_PER_SOL, TransactionInstruction } from '@solana/web3.js';
import { getSolanaConnection } from '../config/solana';
import { lamportsToSol } from './walletManager';

/**
 * Fee estimation result
 */
export interface FeeEstimate {
  baseFee: number; // in lamports
  priorityFee: number; // in lamports
  totalFee: number; // in lamports
  baseFeeSOL: number; // in SOL
  priorityFeeSOL: number; // in SOL
  totalFeeSOL: number; // in SOL
  estimatedComputeUnits: number;
}

/**
 * Get current network fees
 */
export async function getNetworkFees(): Promise<{
  min: number; // lamports per signature
  avg: number;
  max: number;
}> {
  const connection = getSolanaConnection();

  try {
    // Get recent fees from recent blockhashes
    const recentFees = await connection.getRecentPrioritizationFees();

    if (recentFees.length === 0) {
      // Fallback to default estimate
      return {
        min: 5000,
        avg: 5000,
        max: 5000,
      };
    }

    const fees = recentFees.map(f => f.prioritizationFee);
    const min = Math.min(...fees);
    const max = Math.max(...fees);
    const avg = fees.reduce((a, b) => a + b, 0) / fees.length;

    return { min, avg, max };
  } catch (error) {
    // Fallback if API not available
    return {
      min: 5000,
      avg: 5000,
      max: 5000,
    };
  }
}

/**
 * Estimate fee for a transaction
 */
export async function estimateFee(
  instructions: TransactionInstruction[],
  _payer: PublicKey,
  includePriorityFee = true
): Promise<FeeEstimate> {
  // Base fee (5000 lamports per signature is typical)
  const BASE_FEE_PER_SIGNATURE = 5000;

  // Estimate compute units (rough estimate based on instruction count)
  const estimatedComputeUnits = instructions.length * 10000; // ~10k per instruction

  // Get network fees for priority fee
  const networkFees = await getNetworkFees();

  // Calculate priority fee if requested
  const priorityFee = includePriorityFee
    ? Math.floor(estimatedComputeUnits * (networkFees.avg / 1_000_000))
    : 0;

  // Total fee
  const baseFee = BASE_FEE_PER_SIGNATURE;
  const totalFee = baseFee + priorityFee;

  return {
    baseFee,
    priorityFee,
    totalFee,
    baseFeeSOL: lamportsToSol(baseFee),
    priorityFeeSOL: lamportsToSol(priorityFee),
    totalFeeSOL: lamportsToSol(totalFee),
    estimatedComputeUnits,
  };
}

/**
 * Calculate optimal priority fee for fast confirmation
 */
export async function calculateOptimalPriorityFee(
  computeUnits: number,
  urgency: 'low' | 'medium' | 'high' = 'medium'
): Promise<number> {
  const networkFees = await getNetworkFees();

  // Choose fee based on urgency
  let baseFee: number;
  switch (urgency) {
    case 'low':
      baseFee = networkFees.min;
      break;
    case 'high':
      baseFee = networkFees.max;
      break;
    case 'medium':
    default:
      baseFee = networkFees.avg;
      break;
  }

  // Add 20% buffer for high urgency
  if (urgency === 'high') {
    baseFee = Math.floor(baseFee * 1.2);
  }

  // Calculate total priority fee
  return Math.floor(computeUnits * (baseFee / 1_000_000));
}

/**
 * Check if wallet has enough SOL for transaction
 */
export async function hasEnoughSolForTransaction(
  walletPublicKey: PublicKey,
  estimatedFee: number, // in lamports
  buffer = 0.001 // Extra SOL buffer (0.001 SOL default)
): Promise<{
  sufficient: boolean;
  balance: number; // in SOL
  required: number; // in SOL
  shortfall?: number; // in SOL
}> {
  const connection = getSolanaConnection();

  const balance = await connection.getBalance(walletPublicKey);
  const balanceSOL = lamportsToSol(balance);

  const bufferLamports = buffer * LAMPORTS_PER_SOL;
  const requiredLamports = estimatedFee + bufferLamports;
  const requiredSOL = lamportsToSol(requiredLamports);

  const sufficient = balance >= requiredLamports;

  return {
    sufficient,
    balance: balanceSOL,
    required: requiredSOL,
    shortfall: sufficient ? undefined : requiredSOL - balanceSOL,
  };
}

/**
 * Get fee recommendations based on network conditions
 */
export async function getFeeRecommendations(): Promise<{
  economy: FeeEstimate;
  standard: FeeEstimate;
  fast: FeeEstimate;
}> {
  const networkFees = await getNetworkFees();

  const TYPICAL_COMPUTE_UNITS = 200000;

  const createEstimate = (priorityFeeMultiplier: number): FeeEstimate => {
    const baseFee = 5000;
    const priorityFee = Math.floor(
      TYPICAL_COMPUTE_UNITS * ((networkFees.avg * priorityFeeMultiplier) / 1_000_000)
    );
    const totalFee = baseFee + priorityFee;

    return {
      baseFee,
      priorityFee,
      totalFee,
      baseFeeSOL: lamportsToSol(baseFee),
      priorityFeeSOL: lamportsToSol(priorityFee),
      totalFeeSOL: lamportsToSol(totalFee),
      estimatedComputeUnits: TYPICAL_COMPUTE_UNITS,
    };
  };

  return {
    economy: createEstimate(0.5), // 50% of average
    standard: createEstimate(1.0), // 100% of average
    fast: createEstimate(1.5), // 150% of average
  };
}

/**
 * Format fee for display
 */
export function formatFee(lamports: number, includeSymbol = true): string {
  const sol = lamportsToSol(lamports);

  if (sol < 0.000001) {
    return includeSymbol ? '< 0.000001 SOL' : '< 0.000001';
  }

  const formatted = sol.toFixed(6);
  return includeSymbol ? `${formatted} SOL` : formatted;
}

/**
 * Estimate total cost including transaction value
 */
export function estimateTotalCost(
  transactionValue: number, // in SOL
  fee: FeeEstimate
): {
  value: number; // in SOL
  fee: number; // in SOL
  total: number; // in SOL
} {
  return {
    value: transactionValue,
    fee: fee.totalFeeSOL,
    total: transactionValue + fee.totalFeeSOL,
  };
}
