import { PublicKey } from '@solana/web3.js';
import { config } from '../config';
import { getBalance } from './walletManager';
import { checkRpcHealth } from '../config/solana';

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * Validate private key format and security
 */
export function validatePrivateKey(privateKey: string): ValidationResult {
  const warnings: string[] = [];

  // Check if private key is empty
  if (!privateKey || privateKey.trim() === '') {
    return {
      valid: false,
      error: 'Private key is required',
    };
  }

  // Check if it's a placeholder or example key
  const placeholderPatterns = [
    /^test/i,
    /^example/i,
    /^your.?key/i,
    /^replace/i,
    /^change.?me/i,
  ];

  for (const pattern of placeholderPatterns) {
    if (pattern.test(privateKey)) {
      return {
        valid: false,
        error: 'Private key appears to be a placeholder. Use npm run generate-keypair to create one.',
      };
    }
  }

  // Check length (base64 should be ~88 chars, bs58 should be ~87-88 chars)
  if (privateKey.length < 50) {
    return {
      valid: false,
      error: 'Private key is too short. Expected base64 or bs58 encoded key.',
    };
  }

  if (privateKey.length > 200) {
    return {
      valid: false,
      error: 'Private key is too long. Expected base64 or bs58 encoded key.',
    };
  }

  // Warn if private key was accidentally logged (common security mistake)
  if (privateKey.includes(' ') || privateKey.includes('\n')) {
    warnings.push('Private key contains whitespace - ensure it was not copied from logs');
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate wallet readiness for transactions
 */
export async function validateWalletReadiness(
  publicKey: PublicKey,
  minBalance?: number
): Promise<ValidationResult> {
  const warnings: string[] = [];

  try {
    // Check balance
    const balance = await getBalance(publicKey);

    const requiredBalance = minBalance || config.trading.minSolBalance || 0.1;

    if (balance === 0) {
      return {
        valid: false,
        error: 'Wallet has zero SOL. Request airdrop: npm run airdrop',
      };
    }

    if (balance < requiredBalance) {
      warnings.push(
        `Low SOL balance: ${balance.toFixed(4)} SOL. ` +
        `Minimum recommended: ${requiredBalance} SOL. ` +
        `Request more: npm run airdrop`
      );
    }

    // Check if wallet has enough for fees
    const feeBuffer = 0.001; // 0.001 SOL for transaction fees
    if (balance < feeBuffer) {
      return {
        valid: false,
        error: `Insufficient SOL for transaction fees. Balance: ${balance.toFixed(4)} SOL`,
      };
    }

    return {
      valid: true,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to validate wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Validate RPC connection
 */
export async function validateRpcConnection(): Promise<ValidationResult> {
  try {
    const isHealthy = await checkRpcHealth();

    if (!isHealthy) {
      return {
        valid: false,
        error: 'RPC connection failed. Check SOLANA_RPC_URL in .env',
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: `RPC connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Validate Solana configuration
 */
export function validateSolanaConfig(): ValidationResult {
  const warnings: string[] = [];

  // Check if mock mode is disabled
  if (config.trading.mockMode) {
    return {
      valid: false,
      error: 'Mock mode is enabled. Set MOCK_MODE=false to use real devnet',
    };
  }

  // Check if Solana config exists
  if (!config.solana) {
    return {
      valid: false,
      error: 'Solana configuration not loaded. Set MOCK_MODE=false and configure Solana settings',
    };
  }

  // Check RPC URL
  if (!config.solana.rpcUrl) {
    return {
      valid: false,
      error: 'SOLANA_RPC_URL not configured',
    };
  }

  // Warn if using public RPC (rate limits)
  if (config.solana.rpcUrl.includes('api.devnet.solana.com') ||
      config.solana.rpcUrl.includes('api.mainnet-beta.solana.com')) {
    warnings.push(
      'Using public RPC endpoint - rate limits may apply. ' +
      'Consider using a premium RPC for production'
    );
  }

  // Check private key
  if (!config.solana.privateKey) {
    return {
      valid: false,
      error: 'SOLANA_PRIVATE_KEY not configured. Run: npm run generate-keypair',
    };
  }

  // Validate private key format
  const keyValidation = validatePrivateKey(config.solana.privateKey);
  if (!keyValidation.valid) {
    return keyValidation;
  }

  if (keyValidation.warnings) {
    warnings.push(...keyValidation.warnings);
  }

  // Check commitment level
  const validCommitments = ['processed', 'confirmed', 'finalized'];
  if (!validCommitments.includes(config.solana.commitment)) {
    warnings.push(
      `Invalid commitment level: ${config.solana.commitment}. ` +
      `Using 'confirmed' as fallback`
    );
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Validate complete real mode setup
 */
export async function validateRealModeSetup(): Promise<ValidationResult> {
  const warnings: string[] = [];

  // 1. Validate configuration
  const configValidation = validateSolanaConfig();
  if (!configValidation.valid) {
    return configValidation;
  }
  if (configValidation.warnings) {
    warnings.push(...configValidation.warnings);
  }

  // 2. Validate RPC connection
  const rpcValidation = await validateRpcConnection();
  if (!rpcValidation.valid) {
    return rpcValidation;
  }

  // 3. Validate wallet (try to load and check balance)
  try {
    const { loadKeypairFromEnv } = await import('./walletManager');
    const keypair = loadKeypairFromEnv();

    const walletValidation = await validateWalletReadiness(keypair.publicKey);
    if (!walletValidation.valid) {
      return walletValidation;
    }
    if (walletValidation.warnings) {
      warnings.push(...walletValidation.warnings);
    }
  } catch (error) {
    return {
      valid: false,
      error: `Failed to load wallet: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }

  return {
    valid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Security checklist for production
 */
export function getSecurityChecklist(): {
  item: string;
  status: 'ok' | 'warning' | 'critical';
  message: string;
}[] {
  const checklist: {
    item: string;
    status: 'ok' | 'warning' | 'critical';
    message: string;
  }[] = [];

  // Check if .env is in .gitignore
  checklist.push({
    item: 'Private keys not committed',
    status: 'warning',
    message: 'Ensure .env is in .gitignore and never commit private keys',
  });

  // Check mock mode
  checklist.push({
    item: 'Mock mode for testing',
    status: config.trading.mockMode ? 'ok' : 'warning',
    message: config.trading.mockMode
      ? 'Mock mode enabled - safe for testing'
      : 'Real mode enabled - ensure using devnet',
  });

  // Check environment
  checklist.push({
    item: 'Environment check',
    status: config.env === 'production' ? 'critical' : 'ok',
    message: config.env === 'production'
      ? 'CRITICAL: Running in production! Use separate prod keypair'
      : 'Running in development - safe for testing',
  });

  // Check RPC URL
  if (config.solana) {
    const isMainnet = config.solana.rpcUrl.includes('mainnet');
    checklist.push({
      item: 'Network configuration',
      status: isMainnet ? 'critical' : 'ok',
      message: isMainnet
        ? 'CRITICAL: Connected to mainnet! Real funds at risk'
        : 'Connected to devnet - safe for testing',
    });
  }

  return checklist;
}
