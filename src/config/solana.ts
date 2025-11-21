import { Connection, Commitment, ConnectionConfig } from '@solana/web3.js';

export interface SolanaConfig {
  rpcUrl: string;
  rpcBackupUrl?: string;
  commitment: Commitment;
  confirmTimeout: number;
  maxRetries: number;
}

// Solana configuration from environment
export const solanaConfig: SolanaConfig = {
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  rpcBackupUrl: process.env.SOLANA_RPC_BACKUP,
  commitment: (process.env.SOLANA_COMMITMENT as Commitment) || 'confirmed',
  confirmTimeout: parseInt(process.env.SOLANA_CONFIRM_TIMEOUT || '30000', 10),
  maxRetries: parseInt(process.env.SOLANA_MAX_RETRIES || '3', 10),
};

let connectionInstance: Connection | null = null;
let backupConnectionInstance: Connection | null = null;

/**
 * Create Solana connection with configuration
 */
export function createSolanaConnection(usePrimary = true): Connection {
  const url = usePrimary ? solanaConfig.rpcUrl : (solanaConfig.rpcBackupUrl || solanaConfig.rpcUrl);

  const connectionConfig: ConnectionConfig = {
    commitment: solanaConfig.commitment,
    confirmTransactionInitialTimeout: solanaConfig.confirmTimeout,
  };

  return new Connection(url, connectionConfig);
}

/**
 * Get or create primary Solana connection (singleton)
 */
export function getSolanaConnection(): Connection {
  if (!connectionInstance) {
    connectionInstance = createSolanaConnection(true);
  }
  return connectionInstance;
}

/**
 * Get or create backup Solana connection (singleton)
 */
export function getBackupSolanaConnection(): Connection {
  if (!solanaConfig.rpcBackupUrl) {
    throw new Error('Backup RPC URL not configured');
  }

  if (!backupConnectionInstance) {
    backupConnectionInstance = createSolanaConnection(false);
  }
  return backupConnectionInstance;
}

/**
 * Check RPC health
 */
export async function checkRpcHealth(connection?: Connection): Promise<boolean> {
  try {
    const conn = connection || getSolanaConnection();
    const version = await conn.getVersion();
    return !!version['solana-core'];
  } catch (error) {
    return false;
  }
}

/**
 * Get current slot (for health check)
 */
export async function getCurrentSlot(connection?: Connection): Promise<number> {
  const conn = connection || getSolanaConnection();
  return await conn.getSlot();
}

/**
 * Reset connections (useful for testing)
 */
export function resetConnections(): void {
  connectionInstance = null;
  backupConnectionInstance = null;
}
