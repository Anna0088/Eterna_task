/**
 * Configuration Validation Utility
 *
 * Validates environment configuration and provides helpful error messages
 */

import { config } from '../config';
import { ConfigurationError } from './errors';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate Solana configuration (when in real mode)
 */
export function validateSolanaConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.trading.mockMode) {
    // Real mode validation
    if (!config.solana) {
      errors.push('Solana configuration is missing (required when MOCK_MODE=false)');
      return { valid: false, errors, warnings };
    }

    // RPC URL validation
    if (!config.solana.rpcUrl) {
      errors.push('SOLANA_RPC_URL is required');
    } else {
      try {
        new URL(config.solana.rpcUrl);
      } catch {
        errors.push(`Invalid SOLANA_RPC_URL format: ${config.solana.rpcUrl}`);
      }
    }

    // Private key validation
    if (!config.solana.privateKey) {
      errors.push('SOLANA_PRIVATE_KEY is required for real mode');
    } else if (config.solana.privateKey.length < 32) {
      errors.push('SOLANA_PRIVATE_KEY appears to be too short');
    }

    // Commitment level validation
    const validCommitments = ['processed', 'confirmed', 'finalized'];
    if (!validCommitments.includes(config.solana.commitment)) {
      warnings.push(
        `Invalid SOLANA_COMMITMENT: ${config.solana.commitment}. Using 'confirmed' as default.`
      );
    }

    // Timeout validation
    if (config.solana.confirmTimeout < 1000) {
      warnings.push('SOLANA_CONFIRM_TIMEOUT is very low (<1s), may cause timeouts');
    }
    if (config.solana.confirmTimeout > 60000) {
      warnings.push('SOLANA_CONFIRM_TIMEOUT is very high (>60s), may slow down operations');
    }

    // Max retries validation
    if (config.solana.maxRetries < 1) {
      errors.push('SOLANA_MAX_RETRIES must be at least 1');
    }
    if (config.solana.maxRetries > 10) {
      warnings.push('SOLANA_MAX_RETRIES is high (>10), may cause excessive delays');
    }

    // Backup RPC validation
    if (config.solana.rpcBackupUrl) {
      try {
        new URL(config.solana.rpcBackupUrl);
      } catch {
        warnings.push(`Invalid SOLANA_RPC_BACKUP format: ${config.solana.rpcBackupUrl}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate trading configuration
 */
export function validateTradingConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Slippage validation
  if (config.trading.defaultSlippage <= 0 || config.trading.defaultSlippage > 0.5) {
    errors.push(
      `DEFAULT_SLIPPAGE must be between 0 and 0.5 (50%). Current: ${config.trading.defaultSlippage}`
    );
  }

  if (config.trading.defaultSlippage > 0.05) {
    warnings.push(
      `DEFAULT_SLIPPAGE is high (${config.trading.defaultSlippage * 100}%), consider reducing`
    );
  }

  // Price variation validation
  if (config.trading.priceVariationMin >= config.trading.priceVariationMax) {
    errors.push(
      'PRICE_VARIATION_MIN must be less than PRICE_VARIATION_MAX'
    );
  }

  if (config.trading.priceVariationMax > 0.2) {
    warnings.push(
      `PRICE_VARIATION_MAX is high (${config.trading.priceVariationMax * 100}%), may cause simulation issues`
    );
  }

  // SOL balance validation (for real mode)
  if (!config.trading.mockMode && config.trading.minSolBalance < 0.01) {
    warnings.push(
      'MIN_SOL_BALANCE is very low (<0.01 SOL), may not be enough for transaction fees'
    );
  }

  // Compute unit validation
  if (config.trading.computeUnitPrice < 0) {
    errors.push('COMPUTE_UNIT_PRICE cannot be negative');
  }

  if (config.trading.computeUnitLimit < 1000) {
    warnings.push(
      'COMPUTE_UNIT_LIMIT is very low, transactions may fail'
    );
  }

  if (config.trading.computeUnitLimit > 1400000) {
    errors.push(
      `COMPUTE_UNIT_LIMIT exceeds Solana maximum (1400000). Current: ${config.trading.computeUnitLimit}`
    );
  }

  // Supported pairs validation
  if (config.trading.supportedPairs.length === 0) {
    errors.push('No trading pairs configured');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate order processing configuration
 */
export function validateOrderProcessingConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Concurrent orders validation
  if (config.orderProcessing.maxConcurrent < 1) {
    errors.push('MAX_CONCURRENT_ORDERS must be at least 1');
  }

  if (config.orderProcessing.maxConcurrent > 100) {
    warnings.push(
      'MAX_CONCURRENT_ORDERS is very high (>100), may overload the system'
    );
  }

  // Orders per minute validation
  if (config.orderProcessing.ordersPerMinute < 1) {
    errors.push('ORDERS_PER_MINUTE must be at least 1');
  }

  if (config.orderProcessing.ordersPerMinute > 1000) {
    warnings.push(
      'ORDERS_PER_MINUTE is very high (>1000), may cause rate limiting'
    );
  }

  // Retry attempts validation
  if (config.orderProcessing.maxRetryAttempts < 0) {
    errors.push('MAX_RETRY_ATTEMPTS cannot be negative');
  }

  if (config.orderProcessing.maxRetryAttempts > 10) {
    warnings.push(
      'MAX_RETRY_ATTEMPTS is high (>10), failed orders may take long to give up'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate database configuration
 */
export function validateDatabaseConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // MongoDB URI validation
  if (!config.mongodb.uri) {
    errors.push('MONGODB_URI is required');
  } else if (!config.mongodb.uri.startsWith('mongodb://') && !config.mongodb.uri.startsWith('mongodb+srv://')) {
    errors.push('MONGODB_URI must start with mongodb:// or mongodb+srv://');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate Redis configuration
 */
export function validateRedisConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Redis host validation
  if (!config.redis.host) {
    errors.push('REDIS_HOST is required');
  }

  // Redis port validation
  if (config.redis.port < 1 || config.redis.port > 65535) {
    errors.push(`Invalid REDIS_PORT: ${config.redis.port}. Must be between 1 and 65535`);
  }

  if (config.redis.port !== 6379) {
    warnings.push(`Using non-standard Redis port: ${config.redis.port}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate all configuration
 */
export function validateAllConfig(): ValidationResult {
  const results: ValidationResult[] = [
    validateSolanaConfig(),
    validateTradingConfig(),
    validateOrderProcessingConfig(),
    validateDatabaseConfig(),
    validateRedisConfig(),
  ];

  const allErrors = results.flatMap(r => r.errors);
  const allWarnings = results.flatMap(r => r.warnings);

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
  };
}

/**
 * Validate configuration and throw if invalid
 */
export function validateConfigOrThrow(): void {
  const result = validateAllConfig();

  if (!result.valid) {
    const errorMessage = [
      'Configuration validation failed:',
      ...result.errors.map(e => `  ❌ ${e}`),
    ].join('\n');

    throw new ConfigurationError(errorMessage);
  }

  // Log warnings
  if (result.warnings.length > 0) {
    console.warn('⚠️  Configuration warnings:');
    result.warnings.forEach(w => console.warn(`  ⚠️  ${w}`));
  }

  console.log('✅ Configuration validated successfully');
}

/**
 * Get configuration summary
 */
export function getConfigSummary(): Record<string, any> {
  return {
    mode: config.trading.mockMode ? 'MOCK' : 'REAL',
    environment: config.env,
    trading: {
      defaultSlippage: `${config.trading.defaultSlippage * 100}%`,
      supportedPairs: config.trading.supportedPairs.length,
      minSolBalance: config.trading.minSolBalance,
    },
    orderProcessing: {
      maxConcurrent: config.orderProcessing.maxConcurrent,
      ordersPerMinute: config.orderProcessing.ordersPerMinute,
      maxRetryAttempts: config.orderProcessing.maxRetryAttempts,
    },
    solana: config.solana ? {
      rpcUrl: config.solana.rpcUrl,
      hasBackup: !!config.solana.rpcBackupUrl,
      commitment: config.solana.commitment,
      confirmTimeout: `${config.solana.confirmTimeout}ms`,
    } : 'Not configured (mock mode)',
  };
}
